import type { AIMessage } from '@langchain/core/messages'

/**
 * Event types for SSE stream
 */
export type StreamEventType
  = | 'session'
    | 'user_message_id' // 用户消息 ID（用于绑定 AI 回复）
    | 'thinking' // Simple 模式
    | 'content' // Simple 模式
    | 'planning_thinking'
    | 'planning_content'
    | 'plan_status'
    | 'plan'
    | 'worker_start'
    | 'worker_thinking'
    | 'worker_content'
    | 'worker_status'
    | 'worker_complete'
    | 'synthesis_thinking'
    | 'synthesis_content'
    | 'synthesis_status'
    | 'tool_call'
    | 'tool_result'
    | 'token_usage' // Token 使用信息
    | 'error'
    | 'done'

/**
 * Tool call status
 */
export type ToolCallStatus = 'calling' | 'success' | 'error' | 'not_found'

/**
 * Tool call event data
 */
export interface ToolCallEvent {
  toolName: string
  args: any
  taskId?: string
  status: ToolCallStatus
}

/**
 * Tool result event data
 */
export interface ToolResultEvent {
  toolName: string
  result: any
  executionTime?: number
  taskId?: string
  status: ToolCallStatus
}

export interface StreamEvent {
  type: StreamEventType
  data: any
  timestamp?: number
}

/**
 * Chat message request
 */
export interface ChatRequest {
  message: string
  sessionId?: string
  /** 用户ID，用于持久化上下文 */
  userId?: string
  thinkingEnabled?: boolean
  mcpEnabled?: boolean
  mode?: 'auto' | 'orchestrator' | 'simple'
}

/**
 * Chat response
 */
export interface ChatResponse {
  sessionId: string
  message: string
  thinking?: string
}

/**
 * Session configuration
 */
export interface SessionConfig {
  /** 用户ID，用于持久化上下文 */
  userId?: string
  thinkingEnabled?: boolean
  mcpEnabled?: boolean
  mode?: 'auto' | 'orchestrator' | 'simple'
}

/**
 * Token usage information
 */
export interface TokenUsage {
  /** 输入 token 数量 */
  input: number
  /** 输出 token 数量 */
  output: number
  /** 总 token 数量 */
  total?: number
  /** 成本（美元） */
  cost?: number
}

export type AIMessageStructure = AIMessage & {
  id: string
  userMessageId: string
  threadId: string
  userId: string
  rawText: string
  content: string
  timestamp: number
  phase: 'simple' | 'planning' | 'worker' | 'synthesis' | undefined
  planningData?: {
    status: string
    thinking: string
    content: string
    plan: any[]
  }
  synthesisData?: {
    status: string
    thinking: string
    content: string
  }
  workers?: any[]
  workerData?: any
  toolCalls?: any[]
  tokenUsage?: TokenUsage
}
