import type { BiDiClient } from './bidi-client'
import type { FirefoxBrowser } from './browser'
import type { BiDiContext } from './types'
import { FirefoxBiDiSession } from './bidi-session'

/**
 * Firefox Target 封装类
 * 提供类似 ChromeTarget 的 API
 */
export class FirefoxTarget {
  private bidiClient: BiDiClient
  private contextInfo: BiDiContext | null
  private browserInstance: FirefoxBrowser
  private targetType: string

  constructor(
    bidiClient: BiDiClient,
    contextInfo: BiDiContext | null,
    browser: FirefoxBrowser,
    targetType: string = 'page',
  ) {
    this.bidiClient = bidiClient
    this.contextInfo = contextInfo
    this.browserInstance = browser
    this.targetType = targetType
  }

  /**
   * 更新上下文信息
   */
  updateInfo(contextInfo: BiDiContext): void {
    this.contextInfo = contextInfo
  }

  /**
   * 获取目标 URL
   */
  url(): string {
    return this.contextInfo?.url || ''
  }

  /**
   * 获取目标类型
   */
  type(): string {
    return this.targetType
  }

  /**
   * 获取上下文 ID（类似于 Chrome 的 targetId）
   */
  get _targetId(): string {
    return this.contextInfo?.context || 'browser'
  }

  /**
   * 获取浏览器实例
   */
  browser(): FirefoxBrowser {
    return this.browserInstance
  }

  /**
   * 创建 BiDi Session
   * 类似 ChromeTarget.createCDPSession()
   */
  async createCDPSession(): Promise<FirefoxBiDiSession> {
    // 如果是浏览器目标，不能创建 BiDi Session
    if (this.targetType === 'browser') {
      throw new Error('Cannot create BiDi session for browser target. Use a page target instead.')
    }

    const contextId = this.contextInfo?.context || ''
    return new FirefoxBiDiSession(this.bidiClient, contextId, this.targetType)
  }
}
