import { EventEmitter } from 'node:events'
import { ChromeTarget } from './target'
import { ChromeCDPSession } from './cdp-session'
import type { ChromeBrowser } from './browser'
import type { Client } from 'chrome-remote-interface'
import type { Protocol } from 'puppeteer-core'

interface GotoOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'
  timeout?: number
}

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
          flatten: true
        })
        this.sessionId = sessionId
      } catch (error) {
        // 如果 attach 失败，可能是因为 target 已经被 attached
        // 尝试获取现有的 session
        console.warn('Failed to attach to target, trying to get existing session:', error)
        throw error
      }
    }
  }

  async goto(url: string, options?: GotoOptions): Promise<Protocol.Page.NavigateResponse | null> {
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        await this.ensureSession()

        // 启用 Page 域
        await this.client.send('Page.enable', undefined, this.sessionId).catch(() => {
          // 忽略已启用的错误
        })

        const response = await this.client.send('Page.navigate', { url }, this.sessionId)

        if (options?.waitUntil === 'domcontentloaded') {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Navigation timeout'))
            }, options.timeout || 30000)

            const handler = () => {
              clearTimeout(timeout)
              resolve()
            }

            // 注册事件处理器
            this.client.Page.domContentEventFired(handler)

            // 清理函数
            const cleanup = () => {
              clearTimeout(timeout)
              // chrome-remote-interface 的事件是一次性的，不需要手动移除
            }

            // 确保清理
            resolve = ((originalResolve) => {
              return () => {
                cleanup()
                originalResolve()
              }
            })(resolve)

            reject = ((originalReject) => {
              return (error: Error) => {
                cleanup()
                originalReject(error)
              }
            })(reject)
          })
        }

        return response
      } catch (error: any) {
        retries++;

        // 如果是 session 相关的错误，重置 session
        if (error.message?.includes('Session with given id not found') ||
          error.message?.includes('No target with given id found')) {
          this.sessionId = undefined;

          if (retries < maxRetries) {
            // 等待一下再重试
            await new Promise(resolve => setTimeout(resolve, 500 * retries));
            continue;
          }
        }

        // 如果达到最大重试次数或者是其他错误，抛出异常
        throw error;
      }
    }

    throw new Error(`Failed to navigate to ${url} after ${maxRetries} retries`);
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
        awaitPromise: true
      }, this.sessionId) as Protocol.Runtime.EvaluateResponse

      return result.value as T
    } catch (error: any) {
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
      } catch (error) {
        // 忽略 detach 错误
      }
    }
    await this.client.Target.closeTarget({ targetId: this.targetInfo.targetId })
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
