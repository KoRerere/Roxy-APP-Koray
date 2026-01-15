import type { SimpleMessage } from './types'

/**
 * 从后端加载历史记录并转换为简化消息格式
 */
export async function loadSimpleHistory(
  threadId: string,
  userId: string,
  serverUrl: string,
): Promise<SimpleMessage[]> {
  try {
    const response = await fetch(`${serverUrl}/api/history/${userId}`)

    if (!response.ok) {
      if (response.status === 404) {
        console.log('[SimpleHistory] No history found')
        return []
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    const history = data.history || []

    console.log('[SimpleHistory] Raw history data:', JSON.stringify(data, null, 2))

    // 找到对应的 thread
    const threadHistory = history.find((h: any) => h.threadId === threadId)
    if (!threadHistory) {
      console.log('[SimpleHistory] No history found for thread:', threadId)
      return []
    }

    console.log('[SimpleHistory] Thread history:', JSON.stringify(threadHistory, null, 2))

    const messages: SimpleMessage[] = []
    const { userMessages, eventMappings } = threadHistory

    console.log('[SimpleHistory] eventMappings keys:', Object.keys(eventMappings || {}))

    // 按时间戳排序用户消息
    const sortedUserMessages = [...(userMessages || [])].sort(
      (a, b) => a.timestamp - b.timestamp,
    )

    // 为每个用户消息添加对应的 AI 消息
    for (const userMsg of sortedUserMessages) {
      // 添加用户消息
      messages.push({
        id: userMsg.id,
        type: 'user',
        content: userMsg.content,
        timestamp: userMsg.timestamp,
      })

      // 获取该用户消息对应的事件
      const events = eventMappings[userMsg.id] || []

      console.log('[SimpleHistory] Processing events for user message:', userMsg.id, 'events count:', events.length)

      // 处理事件，构建 AI 消息
      let aiContent = ''
      let aiStatus: 'thinking' | 'success' | 'error' = 'thinking'
      let hasContent = false

      for (const event of events) {
        console.log('[SimpleHistory] Processing event:', event.type, event.data)

        if (event.type === 'content') {
          // 提取文本内容
          if (event.data?.text) {
            aiContent += event.data.text
            hasContent = true
          }

          // 检查 content 事件的 status 字段（orchestrator 模式）
          const status = event.data?.status
          const phase = event.data?.phase

          if (status === 'completed' && (phase === 'synthesis' || phase === 'simple')) {
            aiStatus = 'success'
            console.log('[SimpleHistory] Found completed content event, setting status to success')
          }
          else if (status === 'error') {
            aiStatus = 'error'
            console.log('[SimpleHistory] Found error content event, setting status to error')
          }
        }
        else if (event.type === 'done' || event.type === 'token_usage') {
          aiStatus = 'success'
          console.log('[SimpleHistory] Found done event, setting status to success')
        }
        else if (event.type === 'error') {
          aiStatus = 'error'
          if (event.data?.message) {
            aiContent = event.data.message
          }
          console.log('[SimpleHistory] Found error event, setting status to error')
        }
      }

      console.log('[SimpleHistory] Final AI message status:', aiStatus, 'hasContent:', hasContent)

      // 如果有内容或者有事件，添加 AI 消息
      if (hasContent || events.length > 0) {
        messages.push({
          id: `ai_${userMsg.id}`,
          type: 'ai',
          content: aiContent,
          timestamp: userMsg.timestamp + 1,
          status: aiStatus,
          userMessageId: userMsg.id,
        })
      }
    }

    console.log('[SimpleHistory] Loaded messages:', messages.length)
    return messages
  }
  catch (error) {
    console.error('[SimpleHistory] Failed to load history:', error)
    return []
  }
}
