import type { SimpleMessage, SimpleStreamEvent } from './types'

/**
 * 简化版本的消息处理器
 * 只处理用户消息和 AI 消息，忽略其他复杂的事件类型
 */
export class SimpleMessageHandler {
  private messages: SimpleMessage[] = []
  private currentAIMessage: SimpleMessage | null = null
  private currentUserMessageId: string | null = null

  /**
   * 处理 SSE 事件
   */
  handleEvent(event: SimpleStreamEvent): void {
    const { type, data } = event

    console.log('[SimpleMessageHandler] Handling event:', type, data)

    switch (type) {
      case 'user_message_id':
        // 收到 user_message_id 时，创建一条 AI 消息，状态为 thinking
        if (data?.userMessageId) {
          this.currentUserMessageId = data.userMessageId
          console.log('[SimpleMessageHandler] Set userMessageId:', this.currentUserMessageId)
        }

        // 创建新的 AI 消息，状态为 thinking
        this.createAIMessage()
        break

      case 'tool_call':
        this.handleToolCallEvent(data)
        break

      case 'done':
        // 收到 done 时，将状态改为 success
        if (this.currentAIMessage) {
          this.currentAIMessage.status = 'success'
          console.log('[SimpleMessageHandler] AI message completed successfully')
        }
        break

      case 'error':
        // 收到 error 时，将状态改为 error
        if (this.currentAIMessage) {
          this.currentAIMessage.status = 'error'
          this.currentAIMessage.content = data?.message || '发生错误'
          console.log('[SimpleMessageHandler] AI message failed:', this.currentAIMessage.content)
        }
        break

      default:
        // 忽略其他事件类型
        console.log('[SimpleMessageHandler] Ignoring event type:', type)
        break
    }
  }

  /**
   * 创建新的 AI 消息
   */
  private createAIMessage(): void {
    // 如果已经有当前 AI 消息，不重复创建
    if (this.currentAIMessage) {
      console.log('[SimpleMessageHandler] AI message already exists, skipping creation')
      return
    }

    this.currentAIMessage = {
      id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: 'ai',
      content: '',
      timestamp: Date.now(),
      status: 'thinking', // 初始状态为 thinking
      userMessageId: this.currentUserMessageId || undefined,
    }
    this.messages.push(this.currentAIMessage)
    console.log('[SimpleMessageHandler] Created new AI message with status=thinking:', this.currentAIMessage.id)
  }

  /**
   * 处理 content 事件
   */
  private handleContentEvent(data: any): void {
    const text = data?.text || ''

    // 如果还没有当前 AI 消息，创建一个
    if (!this.currentAIMessage) {
      this.createAIMessage()
    }

    // 收到 content 时，将状态改为 generating
    if (data.type === 'tool_call') {
      this.currentAIMessage.status = 'generating'
      console.log('[SimpleMessageHandler] AI message status changed to generating')
    }

    // 累积内容
    if (text && this.currentAIMessage) {
      this.currentAIMessage.content += text
      console.log('[SimpleMessageHandler] Updated AI message content, length:', this.currentAIMessage.content.length)
    }
  }

  private handleToolCallEvent(data: any): void {
    if (this.currentAIMessage) {
      this.currentAIMessage.status = 'generating'
      console.log('[SimpleMessageHandler] AI message status changed to generating')
    }
  }

  /**
   * 添加用户消息
   */
  addUserMessage(content: string, id?: string): SimpleMessage {
    const message: SimpleMessage = {
      id: id || `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: 'user',
      content,
      timestamp: Date.now(),
    }
    this.messages.push(message)
    console.log('[SimpleMessageHandler] Added user message:', message.id)
    return message
  }

  /**
   * 获取所有消息
   */
  getMessages(): SimpleMessage[] {
    return this.messages
  }

  /**
   * 重置状态（新会话开始）
   */
  reset(): void {
    this.currentAIMessage = null
    this.currentUserMessageId = null
    console.log('[SimpleMessageHandler] Reset handler state')
  }

  /**
   * 清空所有消息
   */
  clear(): void {
    this.messages = []
    this.currentAIMessage = null
    this.currentUserMessageId = null
    console.log('[SimpleMessageHandler] Cleared all messages')
  }

  /**
   * 设置消息列表（用于历史记录加载）
   */
  setMessages(messages: SimpleMessage[]): void {
    this.messages = messages
    this.currentAIMessage = null
    this.currentUserMessageId = null
    console.log('[SimpleMessageHandler] Set messages:', messages.length)
  }
}
