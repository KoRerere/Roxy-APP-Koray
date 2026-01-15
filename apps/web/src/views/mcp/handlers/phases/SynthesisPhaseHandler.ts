import type { Message, StreamEvent } from '../../types.js'

/**
 * Synthesis 阶段事件处理器
 * 处理综合阶段的所有事件转换
 */
export class SynthesisPhaseHandler {
  private state = {
    status: 'started' as 'started' | 'thinking' | 'generating' | 'completed',
    thinking: '',
    content: '',
    messageId: null as string | null,
  }

  /**
   * 处理事件
   * @param event - SSE 事件
   * @param onMessageUpdate - 消息更新回调
   */
  handleEvent(event: StreamEvent, onMessageUpdate: (message: Message) => void): void {
    const { type, data } = event

    // 如果 data 不存在，创建一个空对象
    const safeData = data || {}

    switch (type) {
      case 'synthesis_status': {
        const status = (safeData.status || this.state.status) as 'started' | 'thinking' | 'generating' | 'completed'
        this.state.status = status

        // 创建或更新 synthesis 消息
        if (!this.state.messageId) {
          // 创建新的 synthesis 消息
          const messageId = this.generateMessageId()
          this.state.messageId = messageId

          const message: Message = {
            id: messageId,
            type: 'ai',
            content: '',
            phase: 'synthesis',
            eventType: 'synthesis_status',
            synthesisData: {
              status,
              thinking: this.state.thinking,
              content: this.state.content,
            },
            timestamp: event.timestamp || Date.now(),
          }

          onMessageUpdate(message)
        }
        else {
          // 更新现有消息
          onMessageUpdate({
            id: this.state.messageId,
            type: 'ai',
            content: this.state.content,
            rawText: this.state.content,
            phase: 'synthesis',
            eventType: 'synthesis_status',
            synthesisData: {
              status,
              thinking: this.state.thinking,
              content: this.state.content,
            },
            timestamp: event.timestamp || Date.now(),
          } as Message)
        }
        break
      }

      case 'synthesis_thinking': {
        const text = safeData.text || ''
        this.state.thinking += text

        if (this.state.messageId) {
          onMessageUpdate({
            id: this.state.messageId,
            type: 'ai',
            content: this.state.content,
            rawText: this.state.content,
            phase: 'synthesis',
            eventType: 'synthesis_thinking',
            synthesisData: {
              status: this.state.status,
              thinking: this.state.thinking,
              content: this.state.content,
            },
            timestamp: event.timestamp || Date.now(),
          } as Message)
        }
        break
      }

      case 'synthesis_content': {
        const text = safeData.text || ''
        this.state.content += text

        // 如果 data 中有 status 字段，更新状态
        // Server 层可能发送 {type: 'content', phase: 'synthesis', status: 'started'/'generating'/'completed'}
        if (safeData.status) {
          const newStatus = safeData.status as 'started' | 'thinking' | 'generating' | 'completed'
          this.state.status = newStatus
        }

        // 如果 messageId 不存在，创建新的 synthesis 消息
        // 这通常发生在 status: 'started' 或第一个 content 事件时
        if (!this.state.messageId) {
          const messageId = this.generateMessageId()
          this.state.messageId = messageId

          onMessageUpdate({
            id: messageId,
            type: 'ai',
            content: this.state.content,
            rawText: this.state.content,
            phase: 'synthesis',
            eventType: 'synthesis_content',
            synthesisData: {
              status: this.state.status,
              thinking: this.state.thinking,
              content: this.state.content,
            },
            timestamp: event.timestamp || Date.now(),
          } as Message)
        }
        else {
          // 更新现有消息
          onMessageUpdate({
            id: this.state.messageId,
            type: 'ai',
            content: this.state.content,
            rawText: this.state.content,
            phase: 'synthesis',
            eventType: 'synthesis_content',
            synthesisData: {
              status: this.state.status,
              thinking: this.state.thinking,
              content: this.state.content,
            },
            timestamp: event.timestamp || Date.now(),
          } as Message)
        }
        break
      }
    }
  }

  /**
   * 生成消息 ID
   */
  private generateMessageId(): string {
    return `synthesis_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * 获取综合状态
   */
  getStatus(): 'started' | 'thinking' | 'generating' | 'completed' {
    return this.state.status
  }

  /**
   * 获取消息 ID
   */
  getMessageId(): string | null {
    return this.state.messageId
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.state = {
      status: 'started',
      thinking: '',
      content: '',
      messageId: null,
    }
  }
}
