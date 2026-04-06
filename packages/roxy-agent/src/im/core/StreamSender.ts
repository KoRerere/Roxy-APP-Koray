/** 流式消息节流发送器：缓冲文本块，按 throttleMs 间隔批量更新 IM 消息 */
export class StreamSender {
  buffer = ''
  private lastSent = Date.now()
  private messageId: string | null = null
  private readonly throttleMs: number
  private lastSentText = ''

  constructor(throttleMs = 500) {
    this.throttleMs = throttleMs
  }

  async onChunk(
    text: string,
    sendNew: (text: string) => Promise<string>,
    editMsg: (id: string, text: string) => Promise<void>,
  ): Promise<void> {
    this.buffer += text

    const now = Date.now()
    if (now - this.lastSent < this.throttleMs)
      return

    await this.flush(sendNew, editMsg)
    this.lastSent = now
  }

  async flush(
    sendNew: (text: string) => Promise<string>,
    editMsg: (id: string, text: string) => Promise<void>,
  ): Promise<void> {
    if (!this.buffer)
      return

    // 检查内容是否有变化
    if (this.buffer === this.lastSentText)
      return

    if (!this.messageId) {
      this.messageId = await sendNew(this.buffer)
    }
    else {
      try {
        await editMsg(this.messageId, this.buffer)
      }
      catch (error: any) {
        // 忽略 "message is not modified" 错误
        if (!error.message || !error.message.includes('message is not modified')) {
          console.error('[StreamSender] Edit message error:', error)
        }
      }
    }
    this.lastSentText = this.buffer
  }

  reset(): void {
    this.buffer = ''
    this.messageId = null
    this.lastSent = Date.now()
    this.lastSentText = ''
  }
}
