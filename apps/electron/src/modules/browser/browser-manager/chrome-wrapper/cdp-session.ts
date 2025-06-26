import { EventEmitter } from 'node:events'
import type { Client } from 'chrome-remote-interface'

/**
 * CDPSession 封装
 */
export class ChromeCDPSession extends EventEmitter {
  private client: Client
  private sessionId: string
  private targetId: string

  constructor(client: Client, sessionId: string, targetId: string) {
    super()
    this.client = client
    this.sessionId = sessionId
    this.targetId = targetId
  }

  async send(method: string, params?: Record<string, unknown>): Promise<any> {
    // 如果没有 sessionId，说明这是浏览器级别的 Session，直接使用主 client
    if (!this.sessionId || this.targetId === 'browser') {
      return this.client.send(method as any, params)
    }
    return this.client.send(method as any, params, this.sessionId)
  }

  async detach(): Promise<void> {
    // 浏览器级别的 Session 不需要 detach
    if (!this.sessionId || this.targetId === 'browser') {
      return
    }
    await this.client.Target.detachFromTarget({ sessionId: this.sessionId })
  }
}

// 为了兼容性，保留一个更宽松的 send 方法重载
export interface ChromeCDPSession {
  send(method: string, params?: any): Promise<any>
}
