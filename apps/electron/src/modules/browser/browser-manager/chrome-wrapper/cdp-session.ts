import type { Client } from 'chrome-remote-interface'
import { EventEmitter } from 'node:events'

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

    // 监听底层 client 派发的全部事件，并转发给当前 Session
    this.client.on('event', (message: any) => {
      // 只有属于这个 Session 的事件才转发
      // 如果 sessionId 不存在，说明是 browser 级别的 session，接收那些没有 sessionId 的事件
      if (message.sessionId === this.sessionId) {
        this.emit(message.method, message.params)
      }
    })
  }

  async send(method: string, params?: Record<string, unknown> | any): Promise<any> {
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
