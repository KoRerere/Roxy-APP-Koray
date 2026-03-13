import type { ChromeBrowser } from './browser'
import type { Client } from 'chrome-remote-interface'
import type { Protocol } from 'puppeteer-core'
import { EventEmitter } from 'node:events'
import { ChromeCDPSession } from './cdp-session'
import { ChromeTarget } from './target'

/**
 * Page 封装
 */
export class ChromePage extends EventEmitter {
  private client: Client
  private targetInfo: Protocol.Target.TargetInfo
  private browserInstance: ChromeBrowser
  private sessionId?: string
  private cdpSession?: ChromeCDPSession

  constructor(client: Client, targetInfo: Protocol.Target.TargetInfo, browser: ChromeBrowser) {
    super()
    this.client = client
    this.targetInfo = targetInfo
    this.browserInstance = browser
  }

  target(): ChromeTarget {
    return new ChromeTarget(this.client, this.targetInfo, this.browserInstance)
  }

  private async ensureSession(): Promise<void> {
    if (!this.sessionId) {
      try {
        const { sessionId } = await this.client.Target.attachToTarget({
          targetId: this.targetInfo.targetId,
          flatten: true,
        })
        this.sessionId = sessionId
      }
      catch (error) {
        // 如果 attach 失败，可能是因为 target 已经被 attached
        // 尝试获取现有的 session
        console.warn('Failed to attach to target, trying to get existing session:', error)
        throw error
      }
    }
  }

  async goto(params: string | Protocol.Page.NavigateRequest, sessionId?: string | undefined) {
    if (!sessionId) {
      const session = await this.client.Target.attachToTarget({ targetId: this.targetInfo.targetId, flatten: true })
      sessionId = session.sessionId
    }
    if (typeof params === 'string') {
      return this.client.Page.navigate({ url: params }, sessionId)
    }
    return this.client.Page.navigate(params, sessionId)
  }

  async evaluate<T = unknown>(pageFunction: Function | string, ...args: unknown[]): Promise<T> {
    try {
      await this.ensureSession()

      // 启用 Runtime 域
      await this.client.send('Runtime.enable', undefined, this.sessionId).catch(() => {
        // 忽略已启用的错误
      })

      const expression = typeof pageFunction === 'function'
        ? `(${pageFunction.toString()})(${args.map(arg => JSON.stringify(arg)).join(',')})`
        : pageFunction

      const { result } = await this.client.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      }, this.sessionId) as Protocol.Runtime.EvaluateResponse

      return result.value as T
    }
    catch (error: any) {
      // 如果是 session 相关的错误，尝试重新创建 session
      if (error.message?.includes('Session with given id not found')) {
        this.sessionId = undefined
        // 重试一次
        await this.ensureSession()
        return this.evaluate(pageFunction, ...args)
      }
      throw error
    }
  }

  async close(): Promise<void> {
    if (this.sessionId) {
      try {
        await this.client.Target.detachFromTarget({ sessionId: this.sessionId })
      }
      catch (error) {
        // 忽略 detach 错误
      }
    }
    await this.client.Target.closeTarget({ targetId: this.targetInfo.targetId })
  }

  async bringToFront(): Promise<void> {
    try {
      await this.ensureSession()
      await this.client.send('Page.bringToFront', undefined, this.sessionId)
    }
    catch (error) {
      console.warn('Failed to bring page to front:', error)
    }
  }

  url(): string {
    return this.targetInfo.url || ''
  }

  async createCDPSession(): Promise<ChromeCDPSession> {
    await this.ensureSession()
    if (!this.cdpSession) {
      this.cdpSession = new ChromeCDPSession(this.client, this.sessionId!, this.targetInfo.targetId)
    }
    return this.cdpSession
  }
}
