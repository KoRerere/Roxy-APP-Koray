// 附件信息类型
export interface AttachmentInfo {
  fileId: string
  fileName: string
  mimeType: string
  size: number
  url?: string
  localUrl?: string
  remoteUrl?: string
  fileUrl?: string
  preview?: string
  source?: 'upload' | 'generated'
  uploadStatus?: 'uploading' | 'uploaded'
}

export type InputScene = 'automation' | 'asset'

export interface AssetGenerationOptions {
  aspectRatio: string
  quality: string
  count: string
}

export interface GeneratedImageInfo {
  assetId?: string
  fileId: string
  fileName: string
  mimeType?: string
  size?: number
  url?: string
  localUrl?: string
  remoteUrl?: string
  fileUrl?: string
  prompt?: string
  /** true 表示该图片仍在生成中（占位状态） */
  isPending?: boolean
}

// HITL 决策类型
export type HitlDecisionType = 'approve' | 'reject' | 'edit'

export interface HitlDecision {
  type: HitlDecisionType
  reason?: string
  editedAction?: { name: string, args: any }
}

// SSE 事件数据类型
export interface SSEEventData {
  type: 'session' | 'planning' | 'thinking' | 'tool_call' | 'tool_result' | 'worker_thinking' | 'worker_content' | 'worker_result' | 'worker_stopped' | 'orchestrator_stopped' | 'content' | 'synthesis' | 'done' | 'error' | 'interrupt' | 'todo' | 'worker_todo' | 'title' | 'hitl_interrupt' | 'hitl_resume' | 'image_generating' | 'image_partial'
  data?: {
    sessionId?: string
    workerId?: string
    toolId?: string
    toolName?: string
    args?: Record<string, any>
    result?: string
    et?: number
    status?: ToolCallStatus | WorkerStatus
    reason?: string
    error?: string
    text?: string
    taskId?: string
    thinkingId?: string
    contentId?: string
    message?: string
    actionRequests?: Array<{ name: string, args: any, description: string }>
    reviewConfigs?: { actionName: string }[]
    conversationId?: string
    title?: string
    interruptsId?: string
    decisions?: HitlDecision[]
    /** error event（见 roxy-agent docs/error_codes.md，前端优先用 code 分支） */
    code?: string
    category?: string
    retryable?: boolean
    requestId?: string
    source?: 'local' | 'upstream' | 'agent'
    httpStatus?: number
    /** @deprecated 旧字段，等于 httpStatus，仅兼容历史 .sse 回放 */
    errorCode?: number
    /** image generation */
    count?: number
    index?: number
    image?: GeneratedImageInfo
    images?: GeneratedImageInfo[]
    model?: string
    revisedPrompt?: string
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

// Image 消息块（图片生成结果）
export interface ImageBlock {
  type: 'image'
  images: GeneratedImageInfo[]
  /** true 表示仍在生成中（占位状态） */
  isPending?: boolean
}

// 消息块联合类型
export type MessageBlock = ThinkingBlock | ContentBlock | ToolCallBlock | ImageBlock

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

// SSE 解析结果（旧版，保留兼容）
export interface SSEParseResult {
  messageBlocks: MessageBlock[]
  workerTasks: WorkerTask[]
  planningText: string
  synthesisText: string
  endStatus?: ReplyEndStatus
  errorMessage?: string
}

// ─── MessageViewer 展示类型 ───────────────────────────────────────────────────

export type MessageType
  = | 'thinking'
    | 'content'
    | 'tool_call'
    | 'tool_result'
    | 'worker'
    | 'worker_content'
    | 'worker_thinking'
    | 'todo'
    | 'error'
    | 'interrupt'
    | 'hitl_interrupt'
    | 'image'

export type TodoStatus = 'pending' | 'in_progress' | 'completed'

export interface Todo {
  status: TodoStatus
  content: string
}

/** MessageViewer 对外输出的消息条目基础结构 */
export interface MessageEntry {
  type: MessageType
  text: string
  meta: Record<string, unknown>
  start?: number
  end?: number
  status?: WorkerStatus
  /** 仅 thinking 类型使用：true 表示仍在思考中 */
  isThinking?: boolean
}

/** Worker 子条目视图（worker 内部的 thinking / tool_call / content） */
export interface WorkerEntryView extends MessageEntry {
  id: string
}

/** 顶层消息条目视图 */
export interface MessageEntryView extends MessageEntry {
  id: string
  workers: WorkerEntryView[]
}

// ─── 聊天核心类型 ─────────────────────────────────────────────────────────────

// 当前正在构建的回复
export interface CurrentReply {
  sessionId?: string
  mode: 'orchestrator' | 'simple'
  messageBlocks: MessageEntryView[]
  isComplete?: boolean
  endStatus?: ReplyEndStatus
  errorMessage?: string
  startTime: number
  todo: Todo[]
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
  messageBlocks?: MessageEntryView[]
  /** @deprecated 已统一到 messageBlocks 中的 image 块，仅保留用于旧历史格式兼容 */
  generatedImages?: GeneratedImageInfo[]
  isStreaming?: boolean
  endStatus?: ReplyEndStatus
  errorMessage?: string
  /** 用户消息中的附件列表 */
  attachments?: AttachmentInfo[]
}
