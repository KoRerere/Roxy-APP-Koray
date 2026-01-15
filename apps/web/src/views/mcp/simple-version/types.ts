/**
 * 简化版本的消息类型定义
 */

export interface SimpleMessage {
  id: string
  type: 'user' | 'ai'
  content: string
  timestamp: number
  status?: 'thinking' | 'success' | 'error' | 'generating'
  /**
   * AI 消息关联的用户消息 ID
   */
  userMessageId?: string
}

export interface SimpleStreamEvent {
  type: string
  data: any
  timestamp?: number
}
