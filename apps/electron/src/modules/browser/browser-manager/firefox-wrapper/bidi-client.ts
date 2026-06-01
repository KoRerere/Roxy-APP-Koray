import type { BiDiClientOptions, BiDiMessage } from './types'
import type { Commands } from 'webdriver-bidi-protocol'
import { setMaxListeners } from 'node:events'

/** session.new 整体重试窗口：Firefox 冷启动可能较慢 */
export const SESSION_NEW_TIMEOUT_MS = 30_000
/**
 * 两次 session.new 尝试之间的间隔。
 * 单次尝试不设独立超时，使用剩余总时间，避免客户端超时后
 * Firefox 仍处理并创建 session（导致下次 "session not created" 竞态）。
 */
const SESSION_NEW_RETRY_INTERVAL_MS = 500

/**
 * WebDriver BiDi 客户端
 * 提供与 Firefox 浏览器的 BiDi 协议通信能力
 */
export class BiDiClient {
  private ws: WebSocket | null = null
  private connected = false
  private sessionInitialized = false
  private commandId = 0
  private options: BiDiClientOptions
  /**
   * 缓存 session.new 的成功结果。
   * Firefox 存在边界竞态：当 1500ms 窗口等待定时器恰好在窗口打开瞬间触发时，
   * Firefox 先发出 error 响应，但同时已内部创建 session；
   * 此时 sendCommand 的监听器已移除，成功响应通过 ws.onmessage → handleMessage
   * 到达，在此处缓存，供 createSessionWithRetry 在遇到
   * "Maximum number of active sessions" 时直接使用。
   */
  private _capturedSessionResult: Commands['session.new']['returnType'] | null = null

  constructor(options: BiDiClientOptions = {}) {
    this.options = options
  }

  /**
   * 连接到 WebSocket（不创建会话）
   *
   * 候选 URL 按以下策略重试：
   * - baseUrl / /bidi：快速探测，各仅试 1 次，失败立即换下一个 URL
   * - /session：最后兜底，带指数退避重试（最多 {@link SESSION_CONNECT_MAX_RETRIES} 次）
   *
   * 背景：不同 Firefox 版本支持的 BiDi 路径不同；
   * /session 可能隐式创建 session，放在最后避免干扰 session.new 流程，
   * 但它是最稳定可用的路径，需要给予更多重试机会。
   */
  async connect(baseUrl: string, autoCreateSession = false): Promise<void> {
    // 快速探测列表：每个 URL 只试一次，失败直接放弃
    const fastProbeUrls = [baseUrl, `${baseUrl}/bidi`]
    // 兜底 URL：带重试，处理 Firefox 启动竞态（socket bind 慢）
    const fallbackUrl = `${baseUrl}/session`

    /** 首次重试间隔（ms），后续指数增长 */
    const CONNECT_RETRY_BASE_MS = 200
    /** /session 的最大重试次数（总计 ~6.2s 窗口） */
    const SESSION_CONNECT_MAX_RETRIES = 5

    // 快速探测阶段：每个 URL 只试一次
    for (const url of fastProbeUrls) {
      try {
        await this.tryConnect(url, autoCreateSession)
        return
      }
      catch (error) {
        console.warn(`Fast probe failed for ${url}:`, (error as Error).message)
      }
    }

    // 兜底阶段：对 /session 带指数退避重试
    let lastError: Error | undefined
    for (let attempt = 0; attempt <= SESSION_CONNECT_MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = CONNECT_RETRY_BASE_MS * (2 ** (attempt - 1))
        console.log(`Retrying WebSocket connection to ${fallbackUrl} in ${delay}ms (attempt ${attempt}/${SESSION_CONNECT_MAX_RETRIES})`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      try {
        await this.tryConnect(fallbackUrl, autoCreateSession)
        return
      }
      catch (error) {
        lastError = error as Error
        console.warn(`WebSocket connect attempt ${attempt + 1} failed for ${fallbackUrl}:`, (error as Error).message)
      }
    }

    throw new Error(`All WebSocket URLs failed. Last error: ${lastError?.message}`)
  }

  /**
   * 尝试连接指定的 WebSocket URL
   */
  private tryConnect(url: string, autoCreateSession = false): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Trying WebSocket URL: ${url}`)

      const ws = new WebSocket(url)
      let resolved = false

      ws.onopen = () => {
        console.log('WebSocket connected')
        this.ws = ws
        this.connected = true
        // 并发 setCookie 时每个 sendCommand 都会挂一个 message listener，
        // 解除 EventTarget 默认 10 个 listener 的限制，避免 MaxListenersExceededWarning
        setMaxListeners(0, ws)

        if (autoCreateSession) {
          // 委托给 createSessionWithRetry，用 resolved 标志位防止超时后 resolve/reject 竞争
          ;(async () => {
            try {
              await this.createSessionWithRetry()
              if (!resolved) {
                resolved = true
                resolve()
              }
            }
            catch (error) {
              if (!resolved) {
                resolved = true
                reject(error)
              }
            }
          })()
        }
        else {
          // 不自动创建会话，直接返回
          resolved = true
          resolve()
        }
      }

      ws.onmessage = (event) => {
        this.handleMessage(event.data)
      }

      ws.onerror = (_event) => {
        console.error(`WebSocket error for ${url}`)
        if (!resolved) {
          reject(new Error(`WebSocket error for ${url}`))
        }
        this.options.onError?.(new Error('WebSocket error'))
      }

      ws.onclose = () => {
        console.log('WebSocket closed')
        this.connected = false
        this.sessionInitialized = false
        this.ws = null
        if (!resolved) {
          reject(new Error('WebSocket closed before connection established'))
        }
        this.options.onClose?.()
      }

      // 整体超时：与 session.new 重试窗口对齐，避免 Firefox 冷启动时过早失败
      setTimeout(() => {
        if (!resolved) {
          resolved = true
          ws.close()
          reject(new Error('Connection timeout'))
        }
      }, SESSION_NEW_TIMEOUT_MS)
    })
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(data: string): void {
    try {
      const message: BiDiMessage = JSON.parse(data)
      // console.log('Received:', JSON.stringify(message, null, 2))

      // 捕获 session.new 的成功响应（覆盖所有 command id，不只是 0）。
      // 当 sendCommand 的客户端超时先于 Firefox 响应触发时，监听器已被移除，
      // 但 Firefox 仍会把成功结果发过来；在此处缓存，
      // 供 createSessionWithRetry 在 "Maximum number of active sessions" 时使用。
      if (message.type === 'success' && (message.result as any)?.sessionId !== undefined) {
        if (!this._capturedSessionResult) {
          console.log('Session result captured via handleMessage (late response)')
          this._capturedSessionResult = message.result as Commands['session.new']['returnType']
        }
        this.sessionInitialized = true
      }

      // 处理错误
      if (message.type === 'error') {
        console.log(`Error: ${(message as any).error} - ${(message as any).message}`)
      }

      this.options.onMessage?.(message)
    }
    catch (e) {
      console.log('Received (raw):', data)
    }
  }

  /**
   * 发送命令（官方推荐方式）
   * @example
   * ```ts
   * const result = await client.sendCommand('storage.getCookies', {
   *   filter: { domain: 'example.com' }
   * })
   * ```
   */
  async sendCommand<T extends keyof Commands>(
    method: T,
    params: Commands[T]['params'],
    options?: { timeout?: number },
  ): Promise<Commands[T]['returnType']> {
    if (!this.ws || !this.connected) {
      throw new Error('WebSocket not connected')
    }

    const command = {
      id: this.commandId++,
      method,
      params,
    }

    return new Promise<Commands[T]['returnType']>((resolve, reject) => {
      const timeoutMs = options?.timeout ?? 5000
      const messageHandler = (event: MessageEvent) => {
        try {
          const message: BiDiMessage = JSON.parse(event.data)
          if (message.id === command.id) {
            clearTimeout(timeout)
            this.ws?.removeEventListener('message', messageHandler)
            if (message.type === 'success') {
              resolve(message.result)
            }
            else {
              // BiDi 错误响应：{ error: "session not created", message: "Maximum number of active sessions" }
              // 必须同时包含 .error 和 .message，否则上层的 /maximum number of active sessions/i 检测匹配不到
              const bidiCode = (message as any).error || 'Unknown error'
              const bidiDetail = (message as any).message || ''
              reject(new Error(bidiDetail ? `${bidiCode}: ${bidiDetail}` : bidiCode))
            }
          }
        }
        catch (e) {
          // Ignore parse errors
        }
      }

      const timeout = setTimeout(() => {
        this.ws?.removeEventListener('message', messageHandler)
        reject(new Error(`Command timeout: ${method}`))
      }, timeoutMs)

      this.ws?.addEventListener('message', messageHandler)
      this.ws?.send(JSON.stringify(command))
      // console.log(`Sent: ${method}`, params)
    })
  }

  /**
   * 带重试的 session.new，整体不超过 SESSION_NEW_TIMEOUT_MS。
   *
   * 关键设计：每次尝试的超时 = 剩余总时间，而非固定短值。
   * 避免以下竞态：客户端短超时移除监听器后，Firefox 其实已创建 session
   * （响应还在路上），导致下次 session.new 返回 "session not created"。
   *
   * 可重试（瞬态）：
   *   - BiDi error: timeout —— 窗口尚未就绪（"No applicable application window found"）
   *   - session not created —— 并发启动时 Firefox 侧竞态，稍后重试可能成功
   * 不可重试（永久协议错误）：
   *   - unknown command / invalid argument / unsupported operation
   */
  async createSessionWithRetry(): Promise<Commands['session.new']['returnType']> {
    const deadline = Date.now() + SESSION_NEW_TIMEOUT_MS
    let attempt = 0
    while (true) {
      attempt++
      const remaining = deadline - Date.now()
      if (remaining <= 0) {
        throw new Error(`session.new timed out after ${attempt - 1} attempts`)
      }

      console.log(`session.new attempt #${attempt} (${Math.round(remaining / 1000)}s remaining)...`)
      try {
        // 将剩余时间作为单次超时，确保 Firefox 响应能在窗口内到达，
        // 不会因客户端提前超时而产生孤儿 session
        const result = await this.sendCommand('session.new', { capabilities: {} }, { timeout: remaining })
        console.log('Session created successfully')
        this.sessionInitialized = true
        return result
      }
      catch (error) {
        const msg = String(error)

        // 永久性协议错误：立即抛出，不重试
        if (/unknown command|invalid argument|unsupported operation/i.test(msg)
          && !/timeout/i.test(msg)) {
          throw new Error(`session.new fatal error (attempt #${attempt}): ${error}`)
        }

        // "Maximum number of active sessions"：Firefox 内部已有 session（竞态或隐式创建）。
        // 无法通过重试解决，直接使用已有 session 继续。
        if (/maximum number of active sessions/i.test(msg)) {
          if (this._capturedSessionResult) {
            // 捕获到了迟到的成功响应，直接使用
            console.log('session.new: using captured late session result')
            this.sessionInitialized = true
            return this._capturedSessionResult
          }
          // 没有捕获到响应（session 由 Firefox 隐式创建或来自其他途径）
          // BiDi session 绑定 WebSocket 连接，连接本身已可用，合成元数据继续
          console.log('session.new: session already exists on this connection, synthesizing session metadata')
          this.sessionInitialized = true
          const { randomUUID } = await import('node:crypto')
          return {
            sessionId: randomUUID(),
            capabilities: {} as any,
          } as Commands['session.new']['returnType']
        }

        // 剩余时间不足，终止重试
        const remaining2 = deadline - Date.now()
        if (remaining2 <= SESSION_NEW_RETRY_INTERVAL_MS) {
          throw new Error(`session.new failed after ${attempt} attempts: ${error}`)
        }

        // 瞬态错误（窗口未就绪）：等待后重试
        console.log(`session.new attempt #${attempt} failed, retrying in ${SESSION_NEW_RETRY_INTERVAL_MS}ms:`, error)
        await new Promise<void>(r => setTimeout(r, SESSION_NEW_RETRY_INTERVAL_MS))
      }
    }
  }

  /**
   * 获取所有标签页（自定义命令）
   */
  async getTabs(): Promise<any> {
    return this.sendCommand('browser.getTabs' as any, {} as any)
  }

  /**
   * 设置浏览器颜色（自定义命令）
   */
  async setColor(color: string): Promise<any> {
    return this.sendCommand('browser.setColor' as any, { color } as any)
  }

  /**
   * 获取 Cookies (WebDriver BiDi 标准命令)
   */
  async getCookies(params: Commands['storage.getCookies']['params'] = {}) {
    return this.sendCommand('storage.getCookies', params)
  }

  /**
   * 设置 Cookie (WebDriver BiDi 标准命令)
   */
  async setCookie(params: Commands['storage.setCookie']['params']) {
    return this.sendCommand('storage.setCookie', params)
  }

  /**
   * 删除 Cookies (WebDriver BiDi 标准命令)
   */
  async deleteCookies(params: Commands['storage.deleteCookies']['params'] = {}) {
    return this.sendCommand('storage.deleteCookies', params)
  }

  /**
   * 关闭连接
   */
  close(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.connected = false
      this.sessionInitialized = false
    }
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * 检查会话是否已初始化
   */
  isSessionInitialized(): boolean {
    return this.sessionInitialized
  }
}
