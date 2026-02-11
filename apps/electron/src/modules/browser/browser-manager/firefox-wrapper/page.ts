import type { BiDiClient } from './bidi-client'
import type { FirefoxBrowser } from './browser'
import type { BiDiContext } from './types'
import { EventEmitter } from 'node:events'
import { FirefoxBiDiSession } from './bidi-session'
import { FirefoxTarget } from './target'

/**
 * Firefox Page 封装类
 * 提供类似 ChromePage 的 API，基于 WebDriver BiDi 协议
 */
export class FirefoxPage extends EventEmitter {
  private bidiClient: BiDiClient
  private contextInfo: BiDiContext
  private browserInstance: FirefoxBrowser
  private bidiSession?: FirefoxBiDiSession

  constructor(bidiClient: BiDiClient, contextInfo: BiDiContext, browser: FirefoxBrowser) {
    super()
    this.bidiClient = bidiClient
    this.contextInfo = contextInfo
    this.browserInstance = browser
  }

  /**
   * 获取页面的 Target
   */
  target(): FirefoxTarget {
    return new FirefoxTarget(this.bidiClient, this.contextInfo, this.browserInstance)
  }

  /**
   * 导航到指定 URL
   * 兼容 Chrome wrapper 的 API
   */
  async goto(
    params: string | { url: string, wait?: 'none' | 'interactive' | 'complete' },
    options?: { wait?: 'none' | 'interactive' | 'complete' },
  ): Promise<any> {
    try {
      // 统一参数格式
      const url = typeof params === 'string' ? params : params.url
      const wait = typeof params === 'object' && params.wait
        ? params.wait
        : options?.wait || 'none'

      const result = await this.bidiClient.sendCommand('browsingContext.navigate', {
        context: this.contextInfo.context,
        url,
        wait,
      })
      return result.result
    }
    catch (error) {
      console.error('Failed to navigate:', error)
      throw error
    }
  }

  /**
   * 在页面上执行 JavaScript
   */
  async evaluate<T = unknown>(pageFunction: ((...args: any[]) => any) | string, ...args: unknown[]): Promise<T> {
    try {
      const expression = typeof pageFunction === 'function'
        ? `(${pageFunction.toString()})(${args.map(arg => JSON.stringify(arg)).join(',')})`
        : pageFunction

      const result = await this.bidiClient.sendCommand('script.evaluate', {
        expression,
        target: { context: this.contextInfo.context },
        awaitPromise: true,
      })

      // 解析 BiDi 返回值
      if (result.result?.type === 'success') {
        const scriptResult = result.result.result
        // 根据类型解析值
        if (scriptResult?.type === 'string' || scriptResult?.type === 'number' || scriptResult?.type === 'boolean') {
          return scriptResult.value as T
        }
        return scriptResult as T
      }

      return result.result as T
    }
    catch (error) {
      console.error('Failed to evaluate:', error)
      throw error
    }
  }

  /**
   * 关闭页面
   */
  async close(): Promise<void> {
    try {
      await this.bidiClient.sendCommand('browsingContext.close', {
        context: this.contextInfo.context,
      })
    }
    catch (error) {
      console.error('Failed to close page:', error)
      throw error
    }
  }

  /**
   * 获取页面 URL
   */
  url(): string {
    return this.contextInfo.url || ''
  }

  /**
   * 获取上下文 ID
   */
  getContextId(): string {
    return this.contextInfo.context
  }

  /**
   * 更新上下文信息
   */
  updateContextInfo(contextInfo: BiDiContext): void {
    this.contextInfo = contextInfo
  }

  /**
   * 等待导航完成
   * 注意：BiDi 协议的导航通常通过 browsingContext.navigate 的 wait 参数控制
   * 这个方法主要用于兼容性
   */
  async waitForNavigation(options?: { timeout?: number, wait?: 'none' | 'interactive' | 'complete' }): Promise<void> {
    // BiDi 协议推荐在 navigate 时直接指定 wait 参数
    // 如果需要等待，可以重新获取上下文信息来检查加载状态
    try {
      const timeout = options?.timeout || 30000
      const startTime = Date.now()

      // 简单的轮询检查，等待 URL 变化或超时
      while (Date.now() - startTime < timeout) {
        await new Promise(resolve => setTimeout(resolve, 100))
        // 在实际使用中，可以通过监听 BiDi 事件来实现更精确的导航等待
      }
    }
    catch (error) {
      console.error('Failed to wait for navigation:', error)
      throw error
    }
  }

  /**
   * 截图
   */
  async screenshot(options?: {
    type?: 'png' | 'jpeg'
    quality?: number
    path?: string
  }): Promise<Buffer | string> {
    try {
      const result = await this.bidiClient.sendCommand('browsingContext.captureScreenshot', {
        context: this.contextInfo.context,
      })

      // 返回 base64 编码的图片数据
      const data = result.result?.data
      if (options?.path) {
        // 如果指定了路径，这里可以保存文件
        // 简化处理，直接返回数据
      }
      return data
    }
    catch (error) {
      console.error('Failed to take screenshot:', error)
      throw error
    }
  }

  /**
   * 获取页面内容（HTML）
   */
  async content(): Promise<string> {
    return this.evaluate(() => document.documentElement.outerHTML)
  }

  /**
   * 设置页面内容
   */
  async setContent(html: string): Promise<void> {
    await this.evaluate((content: string) => {
      document.open()
      document.write(content)
      document.close()
    }, html)
  }

  /**
   * 创建 BiDi Session
   * 类似 ChromePage.createCDPSession()
   */
  async createCDPSession(): Promise<FirefoxBiDiSession> {
    if (!this.bidiSession) {
      this.bidiSession = new FirefoxBiDiSession(
        this.bidiClient,
        this.contextInfo.context,
        'page',
      )
    }
    return this.bidiSession
  }
}
