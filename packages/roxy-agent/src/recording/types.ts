/** 录制 session 生命周期状态 */
export type RecordingStatus
  = | 'active'
    | 'processing'
    | 'done'
    | 'failed'
    | 'cancelled'
    | 'needs_review'

/** 录制处理阶段（processing 期间的细分） */
export type RecordingPhase
  = | 'skeleton'
    | 'refine'
    | 'enhance'
    | 'done'

/** 事件类型 */
export type RecordingEventType
  = | 'browser_op'
    | 'user_message'

/** browser_op 事件详情 */
export interface BrowserOpEvent {
  type: 'browser_op'
  /** 全局序号，从 1 开始 */
  seq: number
  /** 工具名，如 browser_click */
  toolName: string
  /** 工具入参（脱敏后） */
  input: Record<string, any>
  /** 工具返回值（字符串） */
  result: string
  /** 是否成功 */
  success: boolean
  /** 失败时的错误信息 */
  errorMessage?: string
  /** 执行耗时（ms） */
  durationMs: number
  /** ISO 8601 UTC */
  timestamp: string
  /** browser_click 执行前采集的 DOM 上下文（用于 Refine locator 稳定化） */
  domContext?: DomContext
  /** 当前操作的主 dirId（从 browser_connect_roxy 结果中提取） */
  dirId?: string
  /** 来自哪个 worker（主会话为 undefined） */
  workerId?: string
}

/** DOM 上下文（仅 browser_click 捕获） */
export interface DomContext {
  /** AXTree 祖先链（从目标元素到页面根，最多 3 层） */
  ancestorChain?: AncestorNode[]
  /** 目标元素的 data-testid / data-e2e / aria-label 等稳定属性 */
  testAttrs?: Record<string, string>
  /** 目标元素的 aria-label */
  ariaLabel?: string
  /** 目标元素的 outerHTML 截断（前 500 字符） */
  outerHtmlSnippet?: string
  /** 原始 locator 字符串（AXTree ref 或 CSS selector） */
  rawLocator?: string
}

/** AXTree 祖先节点 */
export interface AncestorNode {
  role?: string
  name?: string
  selector?: string
}

/** 用户消息事件 */
export interface UserMessageEvent {
  type: 'user_message'
  seq: number
  content: string
  timestamp: string
}

/** 联合事件类型 */
export type RecordingEvent = BrowserOpEvent | UserMessageEvent

/** 单个录制 session */
export interface RecordingSession {
  /** 全局唯一 ID，格式 rec_<timestamp>_<random> */
  id: string
  /** 绑定的 conversation ID */
  conversationId: string
  /** 当前状态 */
  status: RecordingStatus
  /** 当前处理阶段（processing 时有值） */
  phase?: RecordingPhase
  /** 录制的主窗口 dirId（第一次 browser_connect_roxy 确定） */
  primaryDirId?: string
  /** 事件序号计数器 */
  eventSeq: number
  /** 事件日志文件路径（NDJSON） */
  eventsFilePath: string
  /** 创建时间 */
  createdAt: number
  /** 停止时间 */
  stoppedAt?: number
  /** 处理完成时间 */
  completedAt?: number
  /** raw skeleton 文件路径 */
  rawSkeletonPath?: string
  /** Refine 后的脚本文件路径 */
  refinedScriptPath?: string
  /** Enhance 后的最终脚本文件路径（经 validate_script 校验通过） */
  enhancedScriptPath?: string
  /** 最终脚本文件路径（= enhancedScriptPath 优先；Enhance 未运行时等于 refinedScriptPath） */
  finalScriptPath?: string
  /** 最终成品脚本入库后的 file_id（save_script 保存，供前端下载）；兜底产物时可能为空 */
  finalScriptFileId?: string
  /** 最终成品脚本的 OSS 下载 URL（save_script 上传成功时有值） */
  finalScriptOssUrl?: string
  /** 失败原因 */
  errorMessage?: string
  /** 工作目录（recordings/<id>/） */
  workDir: string
}
