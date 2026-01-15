import type { Message, StreamEvent, TokenUsage } from '../types'
import type { EventHandlerManager } from '../handlers/EventHandlerManager'

/**
 * SSE事件处理器
 */
export class SSEEventProcessor {
  private eventHandlerManager: EventHandlerManager
  private messages: Message[]

  constructor(eventHandlerManager: EventHandlerManager, messages: Message[]) {
    this.eventHandlerManager = eventHandlerManager
    this.messages = messages
  }

  /**
   * 转换事件
   */
  convertEvent({ type, data }: { type: string, data: any }): StreamEvent {
    let eventType = type as StreamEvent['type']
    let eventData = data
    const phase = data?.phase as string | undefined

    // 1. 合并下状态
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if ('type' in data && ('phase' in data || 'status' in data || 'data' in data)) {
        eventType = data.type || type
        eventData = data.data || data

        // 将顶层的 phase, status 等字段合并到 actualData 中
        if (data.phase) {
          eventData = { ...eventData, phase: data.phase }
        }
        if (data.status) {
          eventData = { ...eventData, status: data.status }
        }
        if (data.taskId) {
          eventData = { ...eventData, taskId: data.taskId }
        }

        // 如果嵌套的 data 中也有这些字段，优先使用嵌套的
        if (data.data && typeof data.data === 'object') {
          if (data.data.phase) {
            eventData = { ...eventData, phase: data.data.phase }
          }
          if (data.data.status) {
            eventData = { ...eventData, status: data.data.status }
          }
        }
      }
    }
    // // 2. 如果 content/thinking 事件包含 phase 信息，转换为对应的事件类型
    // if ((eventType === 'content' || eventType === 'thinking') && phase) {
    //   if (phase === 'synthesis') {
    //     eventType = eventType === 'content' ? 'synthesis_content' : 'synthesis_thinking'
    //   }
    //   else if (phase === 'planning') {
    //     eventType = eventType === 'content' ? 'planning_content' : 'planning_thinking'
    //   }
    //   else if (phase === 'worker') {
    //     eventType = eventType === 'content' ? 'worker_content' : 'worker_thinking'
    //   }
    // }

    return {
      type: eventType,
      data: eventData,
    }
  }

  /**
   * 处理SSE事件
   */
  processEvent(event: { type: string, data: any }): Message[] {
    const { type, data } = event
    console.log('[SSE] Received event:', type, data)

    const { type: actualType, data: actualData } = this.convertEvent({ type, data })

    // 处理 user_message_id 事件
    if (actualType === 'user_message_id' && actualData?.userMessageId) {
      const userMessageId = actualData.userMessageId as string
      this.eventHandlerManager.setUserMessageId(userMessageId)
      console.log('[SSE] Received userMessageId:', userMessageId)

      // 更新前端消息列表中的用户消息 ID
      const lastUserMessage = [...this.messages].reverse().find(msg => msg.type === 'user')
      if (lastUserMessage && (!lastUserMessage.id.startsWith('user_') || lastUserMessage.id !== userMessageId)) {
        lastUserMessage.id = userMessageId
        console.log('[SSE] Updated user message ID to:', userMessageId)
      }

      return this.messages
    }

    // 构建 StreamEvent 对象
    const streamEvent: StreamEvent = {
      type: actualType as StreamEvent['type'],
      data: actualData || {},
      timestamp: Date.now(),
    }

    let pendingTokenUsage: TokenUsage | undefined
    if (actualType === 'token_usage' && actualData) {
      // 转换为前端 TokenUsage 格式
      pendingTokenUsage = {
        input: actualData.prompt_tokens || 0,
        output: actualData.completion_tokens || 0,
        total: actualData.total_tokens || 0,
      }
    }
    else {
      // 使用 EventHandlerManager 处理其他事件
      this.eventHandlerManager.handleEvent(streamEvent)
    }

    // 获取处理后的消息
    const aiMessagesFromManager = this.eventHandlerManager.getMessages() as Message[]
    const existingMessages = [...this.messages]

    // 使用消息 ID 的集合来识别当前正在处理的消息
    const currentAiMessageIds = new Set(aiMessagesFromManager.map(msg => msg.id))
    const existingUserMessages = existingMessages.filter(msg => msg.type === 'user')

    // 保留不在当前处理中的其他 AI 消息
    const existingOtherAiMessages = existingMessages.filter((msg) => {
      if (msg.type !== 'ai')
        return false
      return !currentAiMessageIds.has(msg.id)
    })

    const mergedAiMessages = aiMessagesFromManager

    // 构建用户消息到AI消息的映射
    const userMessageToAiMessages = new Map<string, Message[]>()

    // 将所有AI消息按 userMessageId 分组
    const allAiMessagesMap = new Map<string, Message>()

    // 先添加现有的其他 AI 消息
    for (const msg of existingOtherAiMessages) {
      allAiMessagesMap.set(msg.id, msg)
    }

    // 再添加新的 AI 消息
    for (const msg of mergedAiMessages) {
      allAiMessagesMap.set(msg.id, msg)
    }

    const allAiMessages = Array.from(allAiMessagesMap.values())

    // 确保所有 AI 消息都有 userMessageId
    for (const aiMsg of allAiMessages) {
      if (!aiMsg.userMessageId) {
        const closestUserMsg = [...existingUserMessages]
          .filter(um => um.timestamp <= (aiMsg.timestamp || Date.now()))
          .sort((a, b) => b.timestamp - a.timestamp)[0]

        if (closestUserMsg) {
          aiMsg.userMessageId = closestUserMsg.id
        }
        else if (this.eventHandlerManager.getUserMessageId()) {
          aiMsg.userMessageId = this.eventHandlerManager.getUserMessageId()!
        }
      }

      // 按 userMessageId 分组
      if (aiMsg.userMessageId) {
        if (!userMessageToAiMessages.has(aiMsg.userMessageId)) {
          userMessageToAiMessages.set(aiMsg.userMessageId, [])
        }
        const existingMessages = userMessageToAiMessages.get(aiMsg.userMessageId)!
        if (!existingMessages.find(m => m.id === aiMsg.id)) {
          existingMessages.push(aiMsg)
        }
      }
    }

    // 按用户消息的顺序构建最终消息列表
    const mergedMessages: Message[] = []
    const processedAiMessageIds = new Set<string>()

    const sortedUserMessages = [...existingUserMessages].sort((a, b) => a.timestamp - b.timestamp)

    for (const userMsg of sortedUserMessages) {
      mergedMessages.push(userMsg)

      const aiMessagesForUser = userMessageToAiMessages.get(userMsg.id) || []
      const sortedAiMessages = aiMessagesForUser.sort((a, b) => a.timestamp - b.timestamp)

      for (const aiMsg of sortedAiMessages) {
        if (!processedAiMessageIds.has(aiMsg.id)) {
          mergedMessages.push(aiMsg)
          processedAiMessageIds.add(aiMsg.id)
        }
      }
    }

    // 添加没有关联用户消息的AI消息
    const orphanAiMessages = allAiMessages
      .filter(msg => !processedAiMessageIds.has(msg.id))
      .sort((a, b) => a.timestamp - b.timestamp)

    if (orphanAiMessages.length > 0) {
      console.log('[SSE] Adding orphan AI messages:', orphanAiMessages.length)
      mergedMessages.push(...orphanAiMessages)
    }

    // 如果有待处理的token_usage，绑定到最后一个AI消息
    if (pendingTokenUsage) {
      const lastAiMessage = [...mergedMessages].reverse().find(msg => msg.type === 'ai')
      if (lastAiMessage) {
        lastAiMessage.tokenUsage = pendingTokenUsage
        console.log('[SSE] Token usage bound to message:', lastAiMessage.id, pendingTokenUsage)
      }
      else {
        console.warn('[SSE] No AI message found to bind token usage')
      }
    }

    return mergedMessages
  }
}

/**
 * 创建SSE事件处理器
 */
export function createSSEEventProcessor(
  eventHandlerManager: EventHandlerManager,
  messages: Message[],
): SSEEventProcessor {
  return new SSEEventProcessor(eventHandlerManager, messages)
}
