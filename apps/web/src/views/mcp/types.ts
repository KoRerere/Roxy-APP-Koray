// SSE 事件数据类型
export interface SSEEventData {
  type: 'session' | 'planning' | 'thinking' | 'tool_call' | 'tool_result' | 'worker_thinking' | 'worker_content' | 'worker_result' | 'content' | 'synthesis' | 'done' | 'error' | 'interrupt'
  data?: {
    sessionId?: string
    toolId?: string
    toolName?: string
    args?: Record<string, any>
    result?: string
    et?: number
    status?: ToolCallStatus | WorkerStatus
    text?: string
    taskId?: string
    thinkingId?: string
    contentId?: string
    message?: string
  }
  timestamp?: number
}

// 回复结束状态
export type ReplyEndStatus = 'done' | 'error' | 'interrupt'

// 工具调用状态
export type ToolCallStatus = 'pending' | 'success' | 'failed'

// Worker 任务状态
export type WorkerStatus = 'pending' | 'success' | 'failed'

// 消息块类型
export type MessageBlockType = 'thinking' | 'content' | 'tool_call'

// Thinking 消息块
export interface ThinkingBlock {
  type: 'thinking'
  thinkingId: string
  text: string
  isThinking: boolean
  startTimestamp?: number
  endTimestamp?: number
  taskId?: string
}

// Content 消息块
export interface ContentBlock {
  type: 'content'
  contentId: string
  text: string
  startTimestamp?: number
  taskId?: string
}

// Tool Call 消息块
export interface ToolCallBlock {
  type: 'tool_call'
  toolId: string
  toolName: string
  args: Record<string, any>
  status: ToolCallStatus
  result?: string
  elapsedTime?: number
  taskId?: string
}

// 消息块联合类型
export type MessageBlock = ThinkingBlock | ContentBlock | ToolCallBlock

// 工具调用 (保留用于 WorkerTask 内部)
export interface ToolCall {
  toolId: string
  toolName: string
  args: Record<string, any>
  status: ToolCallStatus
  result?: string
  elapsedTime?: number
  taskId?: string
  /** 事件到达顺序，用于保持 SSE 流顺序 */
  order?: number
}

// Worker Thinking (用于 WorkerTask 内部)
export interface WorkerThinking {
  thinkingId: string
  text: string
  isThinking: boolean
  startTimestamp?: number
  endTimestamp?: number
  /** 事件到达顺序，用于保持 SSE 流顺序 */
  order?: number
}

// Worker Content (用于 WorkerTask 内部)
export interface WorkerContent {
  contentId: string
  text: string
  /** 事件到达顺序，用于保持 SSE 流顺序 */
  order?: number
}

// Worker 任务
export interface WorkerTask {
  taskId: string
  thinkings: WorkerThinking[]
  toolCalls: ToolCall[]
  contents: WorkerContent[]
  status: WorkerStatus
}

// 规划状态
export interface PlanningState {
  /** 是否正在规划中 */
  isPlanning: boolean
  /** 规划开始时间（session 事件的时间戳） */
  startTimestamp?: number
  /** 规划结束时间（planning 结束或其他事件开始的时间戳） */
  endTimestamp?: number
}

// 当前正在构建的回复
export interface CurrentReply {
  sessionId?: string
  mode: 'orchestrator' | 'simple'
  messageBlocks: MessageBlock[]
  workerTasks: WorkerTask[]
  planningText: string
  planningState: PlanningState
  synthesisText: string
  isComplete: boolean
  endStatus?: ReplyEndStatus
  errorMessage?: string
  startTime: number
}

// 头像信息
export interface AvatarInfo {
  name: string
  userName: string
  avatar: string
  color: string
  role: 'user' | 'assistant'
}

// 格式化后的消息
export interface FormattedMessage extends AvatarInfo {
  date: string
  synthesisText?: string
  mode?: string
  messageBlocks?: MessageBlock[]
  workerTasks?: WorkerTask[]
  planningText?: string
  planningState?: PlanningState
  isStreaming?: boolean
  endStatus?: ReplyEndStatus
  errorMessage?: string
}

// SSE 解析结果
export interface SSEParseResult {
  messageBlocks: MessageBlock[]
  workerTasks: WorkerTask[]
  planningText: string
  synthesisText: string
  endStatus?: ReplyEndStatus
  errorMessage?: string
}
