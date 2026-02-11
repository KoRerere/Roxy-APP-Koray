import type { BiDiClient } from './bidi-client'
import type { Commands } from 'webdriver-bidi-protocol'
import { EventEmitter } from 'node:events'

/**
 * Firefox BiDi Session 封装类
 * 提供类似 Puppeteer CDPSession 的 API，用于与 Firefox 的 WebDriver BiDi 协议通信
 * 这个类将 CDP 风格的 API 适配到 BiDi 协议
 */
export class FirefoxBiDiSession extends EventEmitter {
  private bidiClient: BiDiClient
  private contextId: string
  /** Session type: 'page' or 'browser' */
  private sessionType: string
  private eventListeners: Map<string, Set<(...args: any[]) => void>> = new Map()

  constructor(bidiClient: BiDiClient, contextId: string, sessionType: string = 'page') {
    super()
    this.bidiClient = bidiClient
    this.contextId = contextId
    this.sessionType = sessionType
  }

  /**
   * 发送命令（CDP 风格的 API）
   * 将 CDP 命令适配到 BiDi 命令
   */
  async send<T extends keyof Commands>(
    method: T,
    params?: Commands[T]['params'],
  ): Promise<Commands[T]['returnType']>
  async send(method: string, params?: any): Promise<any>
  async send(method: string, params: any = {}): Promise<any> {
    // 如果方法已经是 BiDi 格式（包含点号），直接发送
    if (method.includes('.')) {
      return this.bidiClient.sendCommand(method as any, params)
    }

    // CDP 到 BiDi 的命令映射
    const mappedCommand = this.mapCDPToBiDi(method, params)
    if (mappedCommand) {
      return this.bidiClient.sendCommand(mappedCommand.method as any, mappedCommand.params)
    }

    // 如果没有映射，尝试直接发送
    console.warn(`No BiDi mapping for CDP command: ${method}`)
    return this.bidiClient.sendCommand(method as any, params)
  }

  /**
   * CDP 命令到 BiDi 命令的映射
   */
  private mapCDPToBiDi(method: string, params: any): { method: string, params: any } | null {
    // 浏览器存储相关
    if (method === 'Storage.getCookies') {
      return {
        method: 'storage.getCookies',
        params: params || {},
      }
    }

    if (method === 'Storage.setCookies') {
      // CDP 的 setCookies 批量设置，需要转换
      return {
        method: 'storage.setCookie',
        params: { cookie: params.cookies?.[0] || {} },
      }
    }

    if (method === 'Storage.clearCookies') {
      return {
        method: 'storage.deleteCookies',
        params: params || {},
      }
    }

    // 网络相关
    if (method === 'Network.enable') {
      return {
        method: 'network.addIntercept',
        params: {
          phases: ['beforeRequestSent', 'responseStarted'],
        },
      }
    }

    if (method === 'Network.disable') {
      // BiDi 没有直接的 disable，返回空操作
      return { method: 'browsingContext.getTree' as any, params: {} }
    }

    // 页面相关
    if (method === 'Page.navigate') {
      return {
        method: 'browsingContext.navigate',
        params: {
          context: this.contextId,
          url: params.url,
          wait: params.wait || 'none',
        },
      }
    }

    if (method === 'Page.reload') {
      return {
        method: 'browsingContext.reload',
        params: {
          context: this.contextId,
          wait: params.wait || 'none',
        },
      }
    }

    if (method === 'Page.captureScreenshot') {
      return {
        method: 'browsingContext.captureScreenshot',
        params: {
          context: this.contextId,
          ...params,
        },
      }
    }

    // 脚本执行相关
    if (method === 'Runtime.evaluate') {
      return {
        method: 'script.evaluate',
        params: {
          expression: params.expression,
          target: { context: this.contextId },
          awaitPromise: params.awaitPromise !== false,
          resultOwnership: params.returnByValue ? 'none' : 'root',
        },
      }
    }

    if (method === 'Runtime.callFunctionOn') {
      return {
        method: 'script.callFunction',
        params: {
          functionDeclaration: params.functionDeclaration,
          target: { context: this.contextId },
          arguments: params.arguments || [],
          awaitPromise: params.awaitPromise !== false,
        },
      }
    }

    // DOM 相关
    if (method === 'DOM.getDocument') {
      // BiDi 没有直接对应，返回 null
      return null
    }

    // 浏览上下文相关
    if (method === 'Target.getTargets') {
      return {
        method: 'browsingContext.getTree',
        params: {},
      }
    }

    return null
  }

  /**
   * 分离会话
   */
  async detach(): Promise<void> {
    // BiDi 没有会话的概念，这里只是清理资源
    this.removeAllListeners()
    this.eventListeners.clear()
  }

  /**
   * 获取上下文 ID
   */
  getContextId(): string {
    return this.contextId
  }

  /**
   * 获取会话类型
   */
  getSessionType(): string {
    return this.sessionType
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.bidiClient.isConnected()
  }

  /**
   * 发送 BiDi 命令（类型安全）
   */
  async sendBiDiCommand<T extends keyof Commands>(
    method: T,
    params: Commands[T]['params'],
  ): Promise<Commands[T]['returnType']> {
    return this.bidiClient.sendCommand(method, params)
  }

  /**
   * 监听 BiDi 事件
   */
  on(event: string, handler: (...args: any[]) => void): this {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(handler)
    return super.on(event, handler)
  }

  /**
   * 移除事件监听
   */
  off(event: string, handler: (...args: any[]) => void): this {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(handler)
    }
    return super.off(event, handler)
  }

  /**
   * 触发事件
   */
  emit(event: string, ...args: any[]): boolean {
    return super.emit(event, ...args)
  }
}
