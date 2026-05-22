import type { BiDiClientOptions, BiDiMessage } from './types'
import type { Commands } from 'webdriver-bidi-protocol'

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

  constructor(options: BiDiClientOptions = {}) {
    this.options = options
  }

  /**
   * 连接到 WebSocket（不创建会话）
   */
  async connect(baseUrl: string, autoCreateSession = false): Promise<void> {
    const urlsToTry = [
      `${baseUrl}/session`,
      baseUrl,
      `${baseUrl}/bidi`,
    ]

    for (const url of urlsToTry) {
      try {
        await this.tryConnect(url, autoCreateSession)
        return
      }
      catch (error) {
        console.error(`Failed to connect to ${url}:`, error)
        if (url === urlsToTry[urlsToTry.length - 1]) {
          throw new Error('All WebSocket URLs failed')
        }
      }
    }
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

        if (autoCreateSession) {
          // 自动发送 session.new 命令创建会话
          console.log('Sending session.new to create session...')
          this.sendCommand('session.new', { capabilities: {} })
            .then(() => {
              console.log('Session created successfully')
              resolved = true
              resolve()
            })
            .catch((error) => {
              reject(error)
            })
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

      // 超时处理
      setTimeout(() => {
        if (!resolved) {
          ws.close()
          reject(new Error('Connection timeout'))
        }
      }, 10000)
    })
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(data: string): void {
    try {
      const message: BiDiMessage = JSON.parse(data)
      // console.log('Received:', JSON.stringify(message, null, 2))

      // 检查是否是 session.new 的响应
      if (message.id === 0 && message.type === 'success') {
        this.sessionInitialized = true
        console.log('Session initialized')
      }

      // 处理错误
      if (message.type === 'error') {
        console.log(`Error: ${message.error} - ${message.message}`)
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
      const timeout = setTimeout(() => {
        reject(new Error(`Command timeout: ${method}`))
      }, timeoutMs)

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
              reject(new Error((message as any).error || 'Unknown error'))
            }
          }
        }
        catch (e) {
          // Ignore parse errors
        }
      }

      this.ws?.addEventListener('message', messageHandler)
      this.ws?.send(JSON.stringify(command))
      console.log(`Sent: ${method}`, params)
    })
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
