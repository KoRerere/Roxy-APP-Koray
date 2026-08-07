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
  /** browser_click 执行前采集的 DOM 上下文（用于脚本编写时做 locator 稳定化） */
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
