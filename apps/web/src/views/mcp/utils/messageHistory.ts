import type { Message, StreamEvent, TokenUsage } from '../types'
import type { EventHandlerManager } from '../handlers/EventHandlerManager'

/**
 * 验证用户消息的有效性
 */
export function validateUserMessages(userMessages: any[]): any[] {
  const validated = userMessages.filter((msg: any) => {
    if (!msg || !msg.id || !msg.content) {
      console.warn('[MessageHistory] Invalid user message:', msg)
      return false
    }
    return true
  })

  console.log(`[MessageHistory] Validated ${validated.length} user messages`)
  return validated
}

/**
 * 将用户消息转换为前端消息格式
 */
export function convertUserMessagesToMessages(userMessages: any[]): Message[] {
  return userMessages.map(userMsg => ({
    id: userMsg.id,
    type: 'user' as const,
    content: userMsg.content,
    rawText: userMsg.content,
    timestamp: userMsg.timestamp,
  }))
}

/**
 * 按时间戳排序用户消息ID
 */
export function sortUserMessageIdsByTimestamp(eventMappings: Record<string, any[]>): string[] {
  return Object.keys(eventMappings).sort((a, b) => {
    const aEvents = eventMappings[a] || []
    const bEvents = eventMappings[b] || []
    const aTimestamp = aEvents.find(e => e.type === 'user_message_id')?.timestamp || 0
    const bTimestamp = bEvents.find(e => e.type === 'user_message_id')?.timestamp || 0
    return aTimestamp - bTimestamp
  })
}

/**
 * 处理单个用户消息的事件，生成AI消息
 */
export function processUserMessageEvents(
  userMessageId: string,
  events: any[],
  eventHandlerManager: EventHandlerManager,
): Message[] {
  console.log('processUserMessageEvents events', events)
  eventHandlerManager.resetHandlers()

  let tokenUsage: TokenUsage | undefined

  // 处理该用户消息对应的所有事件
  for (const event of events) {
    const { type, data, phase, timestamp, ...rest } = event
    if (type === 'user_message_id' && data?.userMessageId) {
      eventHandlerManager.setUserMessageId(data.userMessageId)
      continue
    }

    if (type === 'token_usage' && data) {
      const { total_tokens: input = 0, prompt_tokens: output = 0, completion_tokens: total = 0 } = data as { total_tokens?: number, prompt_tokens?: number, completion_tokens?: number }
      if (total) {
        tokenUsage = { input, output, total }
      }
      console.log('[MessageHistory] Token usage from history:', userMessageId)
      continue
    }

    const streamEvent: StreamEvent = {
      phase,
      type: type as StreamEvent['type'],
      data: data || {},
      timestamp: timestamp || Date.now(),

    }

    if (event.phase === 'worker') {
      Object.assign(streamEvent.data, rest)
    }

    eventHandlerManager.handleEvent(streamEvent)
  }

  const aiMessages = eventHandlerManager.getMessages().filter(aiMsg => aiMsg.userMessageId === userMessageId)
  console.log('aiMessages', aiMessages)

  aiMessages.forEach((aiMsg) => {
    // 将token使用信息绑定到AI消息
    if (tokenUsage) {
      aiMsg.tokenUsage = tokenUsage
      console.log('[MessageHistory] Bound token usage to AI message:', aiMsg.id, tokenUsage)
    }
  })

  return aiMessages
}

/**
 * 构建消息对（用户消息 + AI消息）
 */
export function buildMessagePairs(
  userMessagesList: Message[],
  eventMappings: Record<string, any[]>,
  sortedUserMessageIds: string[],
  eventHandlerManager: EventHandlerManager,
): Message[] {
  const allMessages: Message[] = []

  for (const userMessageId of sortedUserMessageIds) {
    const userMessage = userMessagesList.find(msg => msg.id === userMessageId)
    if (!userMessage) {
      console.warn(`[MessageHistory] User message not found: ${userMessageId}`)
      continue
    }

    // 添加用户消息
    allMessages.push(userMessage)

    // 处理事件生成AI消息
    const events = eventMappings[userMessageId] || []
    const aiMessages = processUserMessageEvents(userMessageId, events, eventHandlerManager)

    // 添加AI消息
    allMessages.push(...aiMessages)
  }

  return allMessages
}

/**
 * 从历史记录API响应中加载消息
 */
export async function loadMessagesFromHistory(
  targetSessionId: string,
  userId: string,
  serverUrl: string,
  eventHandlerManager: EventHandlerManager,
): Promise<{ messages: Message[], success: boolean }> {
  try {
    console.log('[MessageHistory] Loading history for session:', targetSessionId)

    // 1. 获取历史记录
    const response = await fetch(`${serverUrl}/api/history/${userId}`)
    if (!response.ok) {
      if (response.status === 404) {
        return { messages: [], success: true }
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    const history = data.history || []

    // 2. 找到目标会话
    const targetHistory = history.find((h: any) => String(h.threadId) === String(targetSessionId))
    if (!targetHistory) {
      console.log('[MessageHistory] No history found for session:', targetSessionId)
      return { messages: [], success: true }
    }

    // 3. 提取和验证数据
    const eventMappings = targetHistory.eventMappings || {}
    const userMessages = targetHistory.userMessages || []
    const validatedUserMessages = validateUserMessages(userMessages)

    // 4. 转换和排序
    const userMessagesList = convertUserMessagesToMessages(validatedUserMessages)
    const sortedUserMessageIds = sortUserMessageIdsByTimestamp(eventMappings)
    console.log(`[MessageHistory] Processing ${sortedUserMessageIds.length} user messages`)

    // 5. 构建消息对
    const allMessages = buildMessagePairs(userMessagesList, eventMappings, sortedUserMessageIds, eventHandlerManager)

    return { messages: allMessages, success: true }
  }
  catch (error: any) {
    console.error('[MessageHistory] Failed to load history:', error)
    return { messages: [], success: false }
  }
}
