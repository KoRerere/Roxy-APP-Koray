import type { BiDiCapabilities, BiDiContext, FirefoxBrowserEvents, ProcessExitData } from './types'
import { BiDiClient } from './bidi-client'
import type { ChildProcess } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { exec } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { setTimeout } from 'node:timers/promises'
import { promisify } from 'node:util'
import { isErrorLike, pidExists } from '/@/utils'
import { FirefoxBiDiSession } from './bidi-session'
import { FirefoxPage } from './page'
import { FirefoxTarget } from './target'

const execAsync = promisify(exec)

/**
 * Firefox 浏览器封装类
 * 提供类似 ChromeBrowser 的 API，基于 WebDriver BiDi 协议
 */
export class FirefoxBrowser extends EventEmitter {
  private bidiClient: BiDiClient
  private browserProcess: ChildProcess | null = null
  private _wsEndpoint: string
  private targetsMap: Map<string, FirefoxTarget> = new Map()
  private disconnectedEmitted = false
  #browserProcessExiting: Promise<void> | null = null
  #exited = false
  private reconnectBiDiInFlight: Promise<void> | null = null
  private sessionId?: string
  private capabilities?: BiDiCapabilities
  actualPort?: number
  /** Marionette 协议端口（供 Selenium/GeckoDriver 使用） */
  marionettePort?: number

  /**
   * Chrome 兼容的 client 接口
   * 提供与 CDP client 类似的 API，但底层使用 WebDriver BiDi
   */
  client: {
    Storage: {
      getCookies: () => Promise<{ cookies: any[] }>
      setCookies: (params: { cookies: any[] }) => Promise<void>
    }
    Browser: {
      getTabs: () => Promise<{ tabs: string }>
    }
  }

  constructor(
    bidiClient: BiDiClient,
    wsEndpoint: string,
    browserProcess?: ChildProcess,
    sessionId?: string,
    capabilities?: BiDiCapabilities,
    actualPort?: number,
    marionettePort?: number,
  ) {
    super()
    this.bidiClient = bidiClient
    this._wsEndpoint = wsEndpoint
    this.browserProcess = browserProcess || null
    this.sessionId = sessionId
    this.capabilities = capabilities
    this.actualPort = actualPort
    this.marionettePort = marionettePort
    this.setupProcessListeners()

    // 初始化 Chrome 兼容的 client 接口
    this.client = this.createCompatibleClient()
  }

  /**
   * 设置进程监听
   */
  private setupProcessListeners() {
    if (this.browserProcess) {
      this.#browserProcessExiting = new Promise<void>((resolve) => {
        this.browserProcess?.once('exit', () => {
          console.debug(`Browser process ${this.browserProcess?.pid} onExit`)
          this.#exited = true
          resolve()
        })
      })

      let closed = false

      // 进程退出事件
      this.browserProcess.on('exit', async (code, signal) => {
        console.debug('browser process exit', code, signal)
        this.emitDisconnected()
        this.emit('process-exit', { code, signal } as ProcessExitData)
        await setTimeout(1500)
        // 如果底层管道建立失败或早期崩溃，导致 Node 无法 cleanly 收尾，则需要手动触发 close
        if (!closed) {
          this.emit('process-close', { code, signal } as ProcessExitData)
          await this.kill()
        }
      })

      // 进程关闭事件
      this.browserProcess.on('close', (code, signal) => {
        console.debug('browser process close', code, signal)
        this.emitDisconnected()
        this.emit('process-close', { code, signal } as ProcessExitData)
        closed = true
      })

      // 进程错误事件
      this.browserProcess.on('error', (error) => {
        console.debug('browser process error', error)
        this.emit('process-error', error)
      })
    }
  }

  /**
   * 发送断开连接事件
   */
  private emitDisconnected() {
    if (!this.disconnectedEmitted) {
      this.disconnectedEmitted = true
      this.emit('disconnected')
    }
  }

  /**
   * 获取 WebSocket 端点
   */
  wsEndpoint(): string {
    return this._wsEndpoint
  }

  /**
   * 获取会话 ID
   */
  getSessionId(): string | undefined {
    return this.sessionId
  }

  /**
   * 获取浏览器能力信息
   */
  getCapabilities(): BiDiCapabilities | undefined {
    return this.capabilities
  }

  /**
   * 优雅终止浏览器进程
   * 发送 SIGTERM（macOS/Linux）或 taskkill /T（Windows）让进程有机会清理后退出。
   * 若等待 termTimeout 毫秒后进程仍存活，则升级为 SIGKILL 强制结束。
   */
  private async terminate(termTimeout = 8000): Promise<void> {
    if (!this.browserProcess?.pid || !pidExists(this.browserProcess.pid)) {
      return
    }

    const pid = this.browserProcess.pid

    // 等待进程退出的 Promise（resolve 由 exit 事件或超时触发）
    const waitExit = new Promise<void>((resolve) => {
      const timer = globalThis.setTimeout(resolve, termTimeout)
      this.browserProcess?.once('exit', () => {
        clearTimeout(timer)
        resolve()
      })
    })

    try {
      if (process.platform === 'win32') {
        // Windows：/T 终止进程树，不带 /F 让进程有机会处理 WM_CLOSE
        // execSync(`taskkill /pid ${pid} /T`)
        console.log('terminate: kill SIGTERM', pid)
        this.browserProcess.kill('SIGTERM')
        console.log('terminate: kill SIGTERM success', pid)
      }
      else if (process.platform === 'darwin') {
        // macOS：通过 JXA ObjC 桥接按 PID 调用 NSRunningApplication.terminate
        // JXA ObjC 桥接中，无参数的 ObjC 方法（如 - (BOOL)terminate）会被当作属性 getter，
        // 直接访问 .terminate 即可触发调用并返回 BOOL（true=成功）。
        // 不能写 .terminate()，否则会尝试调用返回值 true，抛出 "is not a function" 错误。
        try {
          // 使用异步 exec，避免阻塞主进程事件循环
          await execAsync(
            `osascript -l JavaScript -e "ObjC.import('AppKit'); $.NSRunningApplication.runningApplicationWithProcessIdentifier(${pid}).terminate"`,
            { timeout: 5000 },
          )
          console.debug(`[FirefoxBrowser] darwin Apple Event quit (JXA) sent to pid ${pid}`)
        }
        catch (e) {
          console.debug('JXA terminate failed, fallback to SIGTERM', e)
          // JXA 失败时降级为 SIGTERM
          const processGroupId = -pid
          try {
            process.kill(processGroupId, 'SIGTERM')
          }
          catch {
            this.browserProcess.kill('SIGTERM')
          }
        }
      }
      else {
        // Linux：向进程组发送 SIGTERM
        const processGroupId = -pid
        try {
          process.kill(processGroupId, 'SIGTERM')
        }
        catch {
          this.browserProcess.kill('SIGTERM')
        }
      }
    }
    catch (error) {
      console.debug('terminate: failed to send graceful signal', error)
    }

    await waitExit

    // 用 pidExists 做最终判断，避免 exit 事件仍在队列中未处理导致的竞态：
    // osascript/SIGTERM 已触发进程退出，但 Node.js 的 exit 事件可能稍晚到达，
    // 此时 #exited 仍为 false，若仅凭 #exited 判断会误发 SIGKILL 打断优雅退出。
    if (pidExists(pid)) {
      console.debug(`Browser process ${pid} did not exit after graceful signal, escalating to SIGKILL`)
      await this.kill()
    }
  }

  /**
   * 关闭浏览器
   * 优先通过 BiDi browser.close 命令触发 Firefox 优雅退出，让内核有机会写出
   * lumilogin / roxy_tabs / places.sqlite 等数据文件。
   * 兜底路径均使用 SIGTERM → 等待 → SIGKILL 的优雅退出序列，避免直接强杀进程。
   */
  async close(): Promise<void> {
    try {
      console.debug('Sending browser.close command via BiDi')
      await this.bidiClient.sendCommand('browser.close' as any, {} as any)
      console.debug('browser.close command sent successfully')
    }
    catch (error) {
      console.error('Failed to send browser.close:', error)
    }

    if (!this.bidiClient.isConnected()) {
      console.warn('BiDi client not connected, skipping browser.close command')
      // BiDi session 已释放（cookie 导入后主动断开），通过 SIGTERM 优雅退出
      await this.terminate()
      return this.#browserProcessExiting || Promise.resolve()
    }

    // 关闭 BiDi 连接
    this.bidiClient.close()

    // 等待进程退出，给内核足够时间写盘
    if (!this.#exited && this.browserProcess) {
      // 等待最多 5 秒让进程响应 browser.close 自然退出
      const exitTimeout = new Promise<void>((resolve) => {
        const timer = globalThis.setTimeout(resolve, 5000)
        this.browserProcess?.once('exit', () => {
          clearTimeout(timer)
          resolve()
        })
      })
      await exitTimeout

      // browser.close 超时后仍未退出，降级为 SIGTERM 优雅退出序列
      if (!this.#exited) {
        await this.terminate()
      }
    }

    return this.#browserProcessExiting || Promise.resolve()
  }

  /**
   * 强制杀死浏览器进程
   */
  async kill(): Promise<void> {
    console.debug(`Trying to kill ${this.browserProcess?.pid}`)
    // 如果进程启动失败（例如浏览器可执行路径无效），则进程不会获得pid
    // 调用`proc.kill`会出错，因为找不到要杀死的`pid`
    if (
      this.browserProcess
      && this.browserProcess.pid
      && pidExists(this.browserProcess.pid)
    ) {
      try {
        console.debug(`Browser process ${this.browserProcess.pid} exists`)
        if (process.platform === 'win32') {
          try {
            // 使用异步 exec，避免阻塞主进程事件循环
            await execAsync(
              `taskkill /pid ${this.browserProcess.pid} /T /F`,
            )
          }
          catch (error) {
            console.debug(
              `Killing ${this.browserProcess.pid} using taskkill failed`,
              error,
            )
            // taskkill可能由于权限不足等原因无法杀死进程
            // 让我们通过Node API杀死进程。这会延迟杀死`this.proc`的所有子进程
            // 直到主Node.js进程死亡
            this.browserProcess.kill()
          }
        }
        else {
          // 在linux上，进程组可以通过前缀为负号的组ID来杀死
          // 进程组ID是组领导者的pid
          const processGroupId = -this.browserProcess.pid

          try {
            process.kill(processGroupId, 'SIGKILL')
          }
          catch (error) {
            console.debug(
              `Killing ${this.browserProcess.pid} using process.kill failed`,
              error,
            )
            // 由于权限不足等原因，杀死进程组可能会失败
            // 让我们通过Node API杀死进程。这会延迟杀死`this.proc`的所有子进程
            // 直到主Node.js进程死亡
            this.browserProcess.kill('SIGKILL')
          }
        }
      }
      catch (error) {
        throw new Error(
          `Browser process ${this.browserProcess?.pid} kill failed\nError cause: ${isErrorLike(error) ? error.stack : error
          }`,
        )
      }
    }
  }

  /**
   * 将浏览器窗口置于前台（重新激活已运行的实例）
   */
  async bringToFront(): Promise<void> {
    const pages = await this.pages()
    if (pages.length === 0) {
      return
    }

    const preferred = pages.filter((page) => {
      const url = page.url()
      return url && !url.startsWith('about:')
    })
    const target = preferred[preferred.length - 1] ?? pages[pages.length - 1]
    await target.bringToFront()
  }

  /** 展平 browsingContext.getTree 返回的嵌套上下文 */
  private flattenBrowsingContexts(contexts: BiDiContext[]): BiDiContext[] {
    const result: BiDiContext[] = []
    for (const context of contexts) {
      result.push(context)
      const children = (context as BiDiContext & { children?: BiDiContext[] }).children
      if (children?.length) {
        result.push(...this.flattenBrowsingContexts(children))
      }
    }
    return result
  }

  /**
   * 将 BiDi cookie 格式统一转换为 CDP 兼容格式
   * 处理 string / base64 两种 BiDi value 类型，并将 expiry 映射到 expires
   */
  private convertBiDiCookiesToCDP(cookies: any[]): any[] {
    return cookies.map((cookie: any) => {
      // BiDi cookie.value 格式：{ type: 'string', value: string } 或 { type: 'base64', value: string }
      let value: string
      if (typeof cookie.value === 'object' && cookie.value !== null) {
        if (cookie.value.type === 'base64') {
          // base64 类型：解码为 binary 字符串（与 Chrome 行为一致）
          try {
            value = Buffer.from(cookie.value.value, 'base64').toString('binary')
          }
          catch {
            value = cookie.value.value ?? ''
          }
        }
        else {
          // string 类型直接取内层 value
          value = cookie.value.value ?? ''
        }
      }
      else {
        value = String(cookie.value ?? '')
      }

      return {
        name: cookie.name,
        value,
        domain: cookie.domain || '',
        path: cookie.path || '/',
        // BiDi 使用 expiry（秒级时间戳），CDP 使用 expires；undefined/null 统一为 -1 表示 session cookie
        expires: cookie.expiry ?? -1,
        httpOnly: cookie.httpOnly || false,
        secure: cookie.secure || false,
        // BiDi 返回小写 sameSite（'none'|'lax'|'strict'），转换为 CDP 大写形式。
        // 若 BiDi 未返回 sameSite 属性（未显式设置），不包含该属性以避免回写时因缺少 secure 被拒绝
        ...(cookie.sameSite ? { sameSite: cookie.sameSite.charAt(0).toUpperCase() + cookie.sameSite.slice(1) } : {}),
      }
    })
  }

  /**
   * 兜底方案：逐个顶层浏览上下文调用 storage.getCookies，去重后合并
   * 适用于 storage.getCookies {} 全局查询返回空或超时的情况
   * 只遍历顶层 context（tab 级别），不含 iframe，避免重复请求
   */
  private async getCookiesFromAllContexts(): Promise<{ cookies: any[] }> {
    const tree = await this.bidiClient.sendCommand('browsingContext.getTree', {})
    const topLevelContexts = tree?.contexts || []

    const allCookies: any[] = []
    const seenKeys = new Set<string>()

    for (const ctx of topLevelContexts) {
      try {
        const result = await this.bidiClient.sendCommand('storage.getCookies', {
          // 按上下文 partition 查询，确保获取到该 tab 的所有 cookie
          partition: { type: 'context', context: ctx.context } as any,
        })
        for (const cookie of (result?.cookies || [])) {
          // 以 name + domain + path 作为去重 key
          const key = `${cookie.name}|${cookie.domain}|${cookie.path || '/'}`
          if (!seenKeys.has(key)) {
            seenKeys.add(key)
            allCookies.push(cookie)
          }
        }
      }
      catch (ctxError) {
        console.warn(`[Firefox] getCookies for context ${ctx.context} failed:`, ctxError)
      }
    }

    // console.debug(`[Firefox] per-context getCookies: ${allCookies.length} cookies from ${topLevelContexts.length} tab(s)`)
    return { cookies: this.convertBiDiCookiesToCDP(allCookies) }
  }

  /**
   * 获取所有页面（仅顶层 tab，不含 iframe 子上下文）
   * browsingContext.getTree 返回的 contexts 数组即为顶层 tab；
   * iframe 作为 children 嵌套在内，不应作为独立页面暴露，
   * 否则 browsingContext.close 会因非顶层 context 而报错
   */
  async pages(): Promise<FirefoxPage[]> {
    try {
      // 使用 BiDi 的 browsingContext.getTree 获取所有上下文
      const result = await this.bidiClient.sendCommand('browsingContext.getTree', {})
      // 只取顶层 context（tab 级别），不展开 children（iframe 等子上下文）
      const contexts: BiDiContext[] = result?.contexts || []

      const pages: FirefoxPage[] = []
      for (const context of contexts) {
        const page = new FirefoxPage(this.bidiClient, context, this)
        pages.push(page)
      }

      return pages
    }
    catch (error) {
      console.error('Failed to get pages:', error)
      return []
    }
  }

  /**
   * 创建新页面
   */
  async newPage(url = 'about:blank'): Promise<FirefoxPage> {
    /** cookie robot 等场景下 Firefox 创建 tab 可能较慢，默认 5s 易超时 */
    const tabCommandTimeout = { timeout: 30_000 }
    try {
      // 使用 BiDi 的 browsingContext.create 创建新的浏览上下文
      const result = await this.bidiClient.sendCommand('browsingContext.create', {
        type: 'tab' as any,
      }, tabCommandTimeout)

      const contextId = result?.context

      if (url !== 'about:blank') {
        // 导航到指定 URL
        await this.bidiClient.sendCommand('browsingContext.navigate', {
          context: contextId,
          url,
          wait: 'none' as any,
        }, tabCommandTimeout)
      }

      // 获取上下文信息
      const treeResult = await this.bidiClient.sendCommand('browsingContext.getTree', {
        root: contextId,
      }, tabCommandTimeout)

      const context = treeResult?.contexts?.[0]
      return new FirefoxPage(this.bidiClient, context, this)
    }
    catch (error) {
      console.error('Failed to create new page:', error)
      throw error
    }
  }

  /**
   * 获取浏览器目标
   */
  target(): FirefoxTarget {
    return new FirefoxTarget(this.bidiClient, null, this, 'browser')
  }

  /**
   * 获取浏览器进程
   */
  process(): ChildProcess | null {
    return this.browserProcess
  }

  /**
   * 获取 BiDi 客户端（内部使用）
   */
  getBidiClient(): BiDiClient {
    return this.bidiClient
  }

  /**
   * 在 releaseSession() 之后重新建立 BiDi 连接（用于 cookieRobot 等短时自动化）。
   * 复用同一 FirefoxBrowser 实例，保留进程监听，不替换 beforeLaunchTask.browser。
   */
  async reconnectBiDi(): Promise<void> {
    if (this.bidiClient.isConnected()) {
      return
    }
    if (this.reconnectBiDiInFlight) {
      return this.reconnectBiDiInFlight
    }

    this.reconnectBiDiInFlight = this.doReconnectBiDi().finally(() => {
      this.reconnectBiDiInFlight = null
    })
    return this.reconnectBiDiInFlight
  }

  private async doReconnectBiDi(): Promise<void> {
    const newClient = new BiDiClient()
    await newClient.connect(this._wsEndpoint)
    const { sessionId, capabilities } = await newClient.createSessionWithRetry()
    this.bidiClient = newClient
    this.sessionId = sessionId
    this.capabilities = capabilities
    this.client = this.createCompatibleClient()
    console.log('[FirefoxBrowser] BiDi session reconnected for automation')
  }

  /**
   * 释放 BiDi session（发送 session.end 并关闭 WebSocket 连接）。
   * 启动时导入 cookie 完成后调用，避免保持常驻 session。
   * 调用后 client.Storage 方法将变为 no-op，不再可用。
   */
  async releaseSession(): Promise<void> {
    try {
      // 发送 session.end，通知 Firefox 销毁会话
      await this.bidiClient.sendCommand('session.end', {} as any, { timeout: 3000 })
    }
    catch (error) {
      // session.end 失败不影响后续关闭，忽略
      console.warn('[FirefoxBrowser] session.end failed (ignored):', error)
    }
    // 关闭 WebSocket 连接
    this.bidiClient.close()
    // 将 client 替换为 no-op 版本，防止后续调用抛出 "WebSocket not connected"
    this.client = {
      Storage: {
        getCookies: async () => ({ cookies: [] }),
        setCookies: async () => {},
      },
      Browser: {
        getTabs: async () => ({ tabs: '[]' }),
      },
    }
  }

  /**
   * 创建浏览器级别的 BiDi Session
   * 类似 ChromeBrowser.createBrowserCDPSession()
   */
  async createBrowserCDPSession(): Promise<FirefoxBiDiSession> {
    // 对于浏览器级别的操作，创建一个特殊的 BiDi Session
    return new FirefoxBiDiSession(this.bidiClient, '', 'browser')
  }

  /**
   * 创建 Chrome 兼容的 client 接口
   * 将 WebDriver BiDi 的 API 适配为 CDP 风格的 API
   */
  private createCompatibleClient() {
    return {
      Storage: {
        getCookies: async () => {
          try {
            // 使用 BiDi 的 storage.getCookies 命令获取所有 cookie
            // 适当延长超时时间（默认 5s 在 cookie 数量较多时可能不足）
            const result = await this.bidiClient.sendCommand('storage.getCookies', {}, { timeout: 30_000 })
            const cookies = result?.cookies || []

            if (cookies.length > 0) {
              // console.debug(`[Firefox] storage.getCookies (global) returned ${cookies.length} cookies`)
              return { cookies: this.convertBiDiCookiesToCDP(cookies) }
            }

            // 全局查询返回空时，降级为逐上下文查询（兜底）
            // 某些 Firefox 版本或配置下 storage.getCookies {} 可能不返回数据
            // console.warn('[Firefox] storage.getCookies (global) returned empty, falling back to per-context query')
            return this.getCookiesFromAllContexts()
          }
          catch (error) {
            // WebSocket 已断开说明浏览器正在关闭，直接抛出让上层 saveCookies 的 catch 捕获
            // 不能返回 { cookies: [] }，否则会将调用方缓存的有效 cookie 覆盖为空
            if (error instanceof Error && error.message.includes('WebSocket not connected')) {
              throw error
            }
            console.error('[Firefox] Failed to get cookies via BiDi (global):', error)
            // 其他错误：尝试逐上下文查询兜底；若 fallback 也失败则异常上抛，上层 saveCookies 会保留旧缓存
            return await this.getCookiesFromAllContexts()
          }
        },

        setCookies: async (params: { cookies: any[] }) => {
          // BiDi 协议通过命令 ID 区分并发请求，可以同时发出所有 setCookie 命令，
          // 用 Promise.allSettled 等待全部结果，避免串行等待带来的延迟（约 N × RTT）。

          // 将 CDP cookie 格式转换为 BiDi 格式，跳过无效 cookie
          const tasks = params.cookies
            .filter((cookie) => {
              if (!cookie.domain) {
                console.warn('[Firefox] setCookies: skipping cookie with empty domain:', cookie.name)
                return false
              }
              return true
            })
            .map((cookie) => {
              const bidiCookie: any = {
                name: cookie.name,
                value: {
                  type: 'string',
                  // value 防空 undefined/null
                  value: cookie.value ?? '',
                },
                domain: cookie.domain,
              }

              // 可选字段
              if (cookie.path)
                bidiCookie.path = cookie.path
              if (cookie.expires && cookie.expires > 0) {
                // BiDi expiry 为秒级时间戳。
                // 部分 cookie 来源（如从 Chrome/系统导出）以毫秒格式存储（13 位），需转换为秒。
                // 阈值 1e10 可安全区分两者：当前秒级时间戳约 1.78e9，毫秒级约 1.78e12。
                bidiCookie.expiry = cookie.expires > 1e10
                  ? Math.floor(cookie.expires / 1000)
                  : Math.floor(cookie.expires)
              }
              if (cookie.httpOnly !== undefined)
                bidiCookie.httpOnly = cookie.httpOnly
              if (cookie.sameSite) {
                // 转换为小写，BiDi 使用小写
                bidiCookie.sameSite = cookie.sameSite.toLowerCase()
              }
              // RFC 6265bis / Firefox BiDi 要求：SameSite=None 的 cookie 必须带 Secure 标志。
              // 若原始 cookie 的 secure=false 但 sameSite=none，强制置为 true，否则 Firefox 会拒绝写入。
              const isSameSiteNone = bidiCookie.sameSite === 'none'
              bidiCookie.secure = isSameSiteNone ? true : (cookie.secure ?? false)

              return { cookie, bidiCookie }
            })

          // 并发发送所有 setCookie 命令，单个失败不影响其他
          const results = await Promise.allSettled(
            tasks.map(({ bidiCookie }) =>
              this.bidiClient.sendCommand('storage.setCookie', { cookie: bidiCookie }),
            ),
          )

          // 统计失败项并输出日志，便于排查
          let failCount = 0
          results.forEach((result, i) => {
            if (result.status === 'rejected') {
              failCount++
              console.warn(
                `[Firefox] setCookie failed for "${tasks[i].cookie.name}" (${tasks[i].cookie.domain}):`,
                result.reason,
              )
            }
          })
          if (failCount > 0) {
            console.warn(`[Firefox] setCookies: ${failCount}/${tasks.length} cookies failed`)
          }
        },
      },

      Browser: {
        getTabs: async () => {
          try {
            // 使用 BiDi 的 browsingContext.getTree 获取所有上下文
            const result = await this.bidiClient.sendCommand('browsingContext.getTree', {})
            const contexts = result?.contexts || []

            // 转换为类似 CDP 的 tabs 格式
            const tabs = contexts.map((ctx: any) => ({
              target_id: ctx.context,
              url: ctx.url || 'about:blank',
              title: ctx.title || '',
            }))

            return { tabs: JSON.stringify(tabs) }
          }
          catch (error) {
            console.error('Failed to get tabs via BiDi:', error)
            return { tabs: '[]' }
          }
        },
      },
    }
  }

  /**
   * 类型安全的事件方法
   */
  on<K extends keyof FirefoxBrowserEvents>(event: K, listener: FirefoxBrowserEvents[K]): this {
    return super.on(event, listener)
  }

  off<K extends keyof FirefoxBrowserEvents>(event: K, listener: FirefoxBrowserEvents[K]): this {
    return super.removeListener(event, listener)
  }

  emit<K extends keyof FirefoxBrowserEvents>(event: K, ...args: Parameters<FirefoxBrowserEvents[K]>): boolean {
    return super.emit(event, ...args)
  }
}
