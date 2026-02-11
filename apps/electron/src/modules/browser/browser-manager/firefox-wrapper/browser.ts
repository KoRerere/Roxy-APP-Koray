import type { BiDiClient } from './bidi-client'
import type { BiDiCapabilities, FirefoxBrowserEvents, ProcessExitData } from './types'
import type { ChildProcess } from 'node:child_process'
import { execSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { setTimeout } from 'node:timers/promises'
import { isErrorLike, pidExists } from '/@/utils'
import { FirefoxBiDiSession } from './bidi-session'
import { FirefoxPage } from './page'
import { FirefoxTarget } from './target'

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
  private sessionId?: string
  private capabilities?: BiDiCapabilities
  actualPort?: number

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
  ) {
    super()
    this.bidiClient = bidiClient
    this._wsEndpoint = wsEndpoint
    this.browserProcess = browserProcess || null
    this.sessionId = sessionId
    this.capabilities = capabilities
    this.actualPort = actualPort
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
          this.kill()
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
   * 关闭浏览器
   */
  async close(): Promise<void> {
    // 发送结束会话命令
    if (this.sessionId) {
      try {
        await this.bidiClient.sendCommand('session.end', {})
      }
      catch (error) {
        console.error('Failed to end session:', error)
      }
    }

    // 关闭 BiDi 连接
    this.bidiClient.close()

    // 等待进程退出
    if (!this.#exited && this.browserProcess) {
      await setTimeout(100)
      this.kill()
    }

    return this.#browserProcessExiting || Promise.resolve()
  }

  /**
   * 强制杀死浏览器进程
   */
  kill(): void {
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
            execSync(
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
   * 获取所有页面
   */
  async pages(): Promise<FirefoxPage[]> {
    try {
      // 使用 BiDi 的 browsingContext.getTree 获取所有上下文
      const result = await this.bidiClient.sendCommand('browsingContext.getTree', {})
      const contexts = result?.contexts || []

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
    try {
      // 使用 BiDi 的 browsingContext.create 创建新的浏览上下文
      const result = await this.bidiClient.sendCommand('browsingContext.create', {
        type: 'tab' as any,
      })

      const contextId = result?.context

      if (url !== 'about:blank') {
        // 导航到指定 URL
        await this.bidiClient.sendCommand('browsingContext.navigate', {
          context: contextId,
          url,
          wait: 'none' as any,
        })
      }

      // 获取上下文信息
      const treeResult = await this.bidiClient.sendCommand('browsingContext.getTree', {
        root: contextId,
      })

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
            // 使用 BiDi 的 storage.getCookies 命令
            const result = await this.bidiClient.sendCommand('storage.getCookies', {})
            const cookies = result?.cookies || []

            // 转换 BiDi cookie 格式为 CDP 格式
            const cdpCookies = cookies.map((cookie: any) => {
              // BiDi cookie.value 可能是 { type: 'string', value: string } 格式
              const value = typeof cookie.value === 'object' && cookie.value.value
                ? cookie.value.value
                : cookie.value

              return {
                name: cookie.name,
                value,
                domain: cookie.domain || '',
                path: cookie.path || '/',
                expires: cookie.expiry || -1,
                httpOnly: cookie.httpOnly || false,
                secure: cookie.secure || false,
                sameSite: cookie.sameSite || 'None',
              }
            })

            return { cookies: cdpCookies }
          }
          catch (error) {
            console.error('Failed to get cookies via BiDi:', error)
            return { cookies: [] }
          }
        },

        setCookies: async (params: { cookies: any[] }) => {
          try {
            // BiDi 一次只能设置一个 cookie，需要循环设置
            for (const cookie of params.cookies) {
              // 转换 CDP cookie 格式为 BiDi 格式
              const bidiCookie: any = {
                name: cookie.name,
                value: {
                  type: 'string',
                  value: cookie.value,
                },
                domain: cookie.domain || '',
              }

              // 可选字段
              if (cookie.path)
                bidiCookie.path = cookie.path
              if (cookie.expires && cookie.expires > 0) {
                // CDP 的 expires 是秒级时间戳，BiDi 的 expiry 也是秒级
                bidiCookie.expiry = Math.floor(cookie.expires)
              }
              if (cookie.httpOnly !== undefined)
                bidiCookie.httpOnly = cookie.httpOnly
              if (cookie.secure !== undefined)
                bidiCookie.secure = cookie.secure
              if (cookie.sameSite) {
                // 转换为小写，BiDi 使用小写
                bidiCookie.sameSite = cookie.sameSite.toLowerCase()
              }

              // 使用 BiDi 的 storage.setCookie 命令
              await this.bidiClient.sendCommand('storage.setCookie', {
                cookie: bidiCookie,
              })
            }
          }
          catch (error) {
            console.error('Failed to set cookies via BiDi:', error)
            throw error
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
