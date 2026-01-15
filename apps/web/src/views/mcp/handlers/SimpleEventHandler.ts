import type { Message, StreamEvent, ToolCall } from '../types.js'

/**
 * Simple 模式事件处理器
 * 处理 Simple 模式的事件（thinking, content）
 */
export class SimpleEventHandler {
  private state = {
    thinking: '',
    content: '',
    toolCalls: [] as ToolCall[],
    messageId: null as string | null,
  }

  /**
   * 处理事件
   */
  handleEvent(event: StreamEvent, onMessageUpdate: (message: Message) => void): void {
    const { type, data } = event

    // 如果 data 不存在，跳过处理
    if (!data) {
      console.warn('[SimpleEventHandler] Event data is undefined:', event)
      return
    }

    switch (type) {
      case 'thinking': {
        const text = data.text || ''
        this.state.thinking += text

        // 创建或更新 simple 消息
        if (!this.state.messageId) {
          const messageId = this.generateMessageId()
          this.state.messageId = messageId

          const message: Message = {
            id: messageId,
            type: 'ai',
            content: this.state.content,
            rawText: this.state.content,
            phase: 'simple',
            eventType: 'thinking',
            toolCalls: [...this.state.toolCalls],
            timestamp: event.timestamp || Date.now(),
          }

          onMessageUpdate(message)
        }
        else {
          onMessageUpdate({
            id: this.state.messageId,
            type: 'ai',
            content: this.state.content,
            rawText: this.state.content,
            phase: 'simple',
            eventType: 'thinking',
            toolCalls: [...this.state.toolCalls],
            timestamp: event.timestamp || Date.now(),
          } as Message)
        }
        break
      }

      case 'content': {
        const text = data.text || ''

        // 累积内容
        this.state.content += text

        // 创建或更新 simple 消息
        // 即使 status 是 'started' 且没有内容，也要创建消息，以便前端可以显示"正在生成"的状态
        if (!this.state.messageId) {
          const messageId = this.generateMessageId()
          this.state.messageId = messageId

          const message: Message = {
            id: messageId,
            type: 'ai',
            content: this.state.content,
            rawText: this.state.content,
            phase: 'simple',
            eventType: 'content',
            toolCalls: [...this.state.toolCalls],
            timestamp: event.timestamp || Date.now(),
          }

          onMessageUpdate(message)
        }
        else {
          onMessageUpdate({
            id: this.state.messageId,
            type: 'ai',
            content: this.state.content,
            rawText: this.state.content,
            phase: 'simple',
            eventType: 'content',
            toolCalls: [...this.state.toolCalls],
            timestamp: event.timestamp || Date.now(),
          } as Message)
        }
        break
      }

      case 'tool_call': {
        // 从 data.toolName 获取工具名称（统一格式）
        const toolName = (data.toolName as string) || 'unknown_tool'
        const args = data.args || {}

        const toolCall: ToolCall = {
          toolName,
          args,
        }

        this.state.toolCalls.push(toolCall)

        // 如果没有消息 ID，创建一个
        if (!this.state.messageId) {
          const messageId = this.generateMessageId()
          this.state.messageId = messageId
        }

        onMessageUpdate({
          id: this.state.messageId!,
          type: 'ai',
          content: this.state.content,
          rawText: this.state.content,
          phase: 'simple',
          eventType: 'tool_call',
          toolCalls: [...this.state.toolCalls],
          timestamp: event.timestamp || Date.now(),
        } as Message)
        break
      }

      case 'tool_result': {
        const toolName = (data.toolName as string) || 'unknown_tool'
        const result = data.result as any
        const executionTime = data.executionTime as number | undefined

        if (!toolName) {
          console.warn('[SimpleEventHandler] tool_result: toolName is missing', data)
          break
        }

        // 查找对应的工具调用（通过工具名称匹配，且没有结果）
        const toolCall = this.state.toolCalls.find(tc => tc.toolName === toolName && !tc.result)
        if (toolCall) {
          toolCall.result = result
          toolCall.executionTime = executionTime
        }
        else {
          this.state.toolCalls.push({
            toolName,
            args: {},
            result,
            executionTime,
          })
        }

        // 如果没有消息 ID，创建一个
        if (!this.state.messageId) {
          const messageId = this.generateMessageId()
          this.state.messageId = messageId
        }

        onMessageUpdate({
          id: this.state.messageId!,
          type: 'ai',
          content: this.state.content,
          rawText: this.state.content,
          phase: 'simple',
          eventType: 'tool_result',
          toolCalls: [...this.state.toolCalls],
          timestamp: event.timestamp || Date.now(),
        } as Message)
        break
      }
    }
  }

  /**
   * 生成消息 ID
   */
  private generateMessageId(): string {
    return `simple_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.state = {
      thinking: '',
      content: '',
      toolCalls: [],
      messageId: null,
    }
  }
}
