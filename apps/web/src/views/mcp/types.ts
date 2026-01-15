/**
 * SSE 事件类型定义
 * 与后端保持一致
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
    | 'token_usage'
    | 'error'
    | 'done'

/**
 * SSE 事件接口
 */
export interface StreamEvent {
  phase?: 'planning' | 'worker' | 'synthesis' | 'simple'
  type: StreamEventType
  data: any
  timestamp?: number
}

export interface TokenUsage {
  input?: number
  output?: number
  total?: number
  cost?: number
}

/**
 * 计划任务接口
 */
export interface PlanTask {
  taskId: string
  task: string
  dependencies?: string[]
  status?: 'pending' | 'running' | 'completed'
}

/**
 * Worker 状态接口
 */
export interface WorkerState {
  taskId: string
  task: string
  status: 'pending' | 'running' | 'completed' | 'error'
  /**
   * 流式累加
   */
  thinking: string
  content: string /**
                   * 流式累加
                   */
  toolCalls?: Array<{
    toolName: string
    args: any
    result?: any
    executionTime?: number
    taskId?: string
  }>
}

/**
 * 工具调用接口
 */
export interface ToolCall {
  toolName: string
  args: any
  result?: any
  executionTime?: number
  taskId?: string
}

/**
 * 消息接口
 */
export interface Message {
  /**
   * 唯一标识
   */
  id: string
  type: 'user' | 'ai'
  content: string
  /**
   * 原始文本（用于 markdown 渲染）
   */
  rawText?: string

  /**
   * 关联的用户消息ID（AI消息使用，用于绑定用户消息和AI回复）
   */
  userMessageId?: string

  /**
   * Token 使用信息（可选）
   */
  tokenUsage?: TokenUsage

  /**
   * 阶段信息
   */
  phase?: 'planning' | 'worker' | 'synthesis' | 'simple'
  /**
   * 新的事件类型
   */
  eventType?: StreamEventType

  /**
   * Planning 阶段数据
   */
  planningData?: {
    status?: 'analyzing' | 'drafting' | 'generated' | 'started' | 'generating' | 'completed'
    plan?: PlanTask[]
    thinking?: string /**
                       * 流式累加
                       */
    /**
     * 流式累加
     */
    content?: string
  }

  /**
   * Worker 阶段数据（单个 worker，用于向后兼容）
   * @deprecated 使用 workers 数组代替
   */
  workerData?: {
    taskId: string
    task: string
    status: 'pending' | 'running' | 'completed' | 'error'
    /**
     * 流式累加
     */
    thinking?: string
    /**
     * 流式累加
     */
    content?: string
  }

  /**
   * Worker 阶段数据（多个 worker）
   */
  workers?: Array<{
    taskId: string
    task: string
    status: 'pending' | 'running' | 'completed' | 'error'
    /**
     * 流式累加
     */
    thinking?: string
    /**
     * 流式累加
     */
    content?: string
    toolCalls?: ToolCall[]
  }>

  /**
   * Synthesis 阶段数据
   */
  synthesisData?: {
    status?: 'started' | 'thinking' | 'generating' | 'completed'
    /**
     * 流式累加
     */
    thinking?: string
    /**
     * 流式累加
     */
    content?: string
  }

  /**
   * 工具调用（Simple 模式或通用）
   */
  toolCalls?: ToolCall[]

  timestamp: number
}
