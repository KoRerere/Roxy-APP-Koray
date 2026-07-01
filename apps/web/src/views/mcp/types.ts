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
  type: 'session' | 'planning' | 'thinking' | 'thinking_complete' | 'tool_call' | 'tool_result' | 'worker_thinking' | 'worker_content' | 'worker_result' | 'worker_stopped' | 'worker_dispatch' | 'orchestrator_stopped' | 'content' | 'synthesis' | 'done' | 'error' | 'interrupt' | 'todo' | 'worker_todo' | 'title' | 'hitl_interrupt' | 'hitl_resume' | 'image_generating' | 'image_partial' | 'image_done' | 'script_log' | 'agent_file' | 'retry' | 'worker_retry'
  data?: {
    sessionId?: string
    workerId?: string
    toolId?: string
    toolName?: string
    args?: Record<string, any>
    /** parallel_dispatch 工具的并行任务数量（后端注入，用于前端文案展示） */
    assignmentsCount?: number
    /** load_skill_file 工具加载的 skill 名（后端解析路径注入） */
    skillName?: string
    /** load_skill_file 工具加载的文件相对 skill 目录的路径（如 tiktok-matrix-upload/references/harness.md，后端解析路径注入） */
    skillFilePath?: string
    /** 文件系统/脚本类工具的操作目标简述（后端解析 args 注入：文件名/目录名/pattern/脚本名，前端卡片拼接展示） */
    target?: string
    result?: string
    et?: number
    status?: ToolCallStatus | WorkerStatus
    reason?: string
    error?: string
    text?: string
    taskId?: string
    thinkingId?: string
    startTimestamp?: number
    endTimestamp?: number
    durationMs?: number
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
    todos?: Todo[]
    model?: string
    revisedPrompt?: string
    /** script_log（run_script 沙箱脚本运行日志） */
    runId?: string
    scriptName?: string
    level?: string
    /** agent_file（chat agent write_file/edit_file 产物） */
    fileId?: string
    fileName?: string
    size?: number
    mimeType?: string
    op?: 'create' | 'update'
    /** retry / worker_retry（模型调用网络中断自动重试）：retryId 标识同一重试序列（前端原地更新次数），attempt 从 1 计数，maxAttempts 为最大重试次数 */
    retryId?: string
    attempt?: number
    maxAttempts?: number
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
    | 'script_log' // run_script 沙箱脚本 console.* 输出
    | 'agent_file' // chat agent write_file/edit_file 产物文件卡片
    | 'retry' // 顶层模型调用网络中断自动重试提示（「重试中…(n/N)」）

export type TodoStatus = 'pending' | 'in_progress' | 'completed'

export interface Todo {
  status: TodoStatus
  content: string
}

/** script_log 单条日志行 */
export interface ScriptLogLine {
  level?: string
  scriptName?: string
  text: string
}

/** agent_file 单个生成文件 */
export interface AgentFileItem {
  fileId: string
  fileName: string
  size: number
  mimeType: string
  op?: 'create' | 'update'
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
  /** 仅 thinking 类型使用：agent 侧权威计时（毫秒） */
  authoritativeDuration?: number
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
  /** 虚拟列表 key，DynamicScroller 的 key-field 依赖该字段，必须非空且唯一 */
  id: string
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
