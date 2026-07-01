import type { DomContext } from '@/recording/types'
import { createMiddleware } from 'langchain'
import { recordingManager } from '@/recording/recordingManager'

/** browser_* 工具名前缀（含 roxybrowser_playwright 命名空间） */
const BROWSER_TOOL_PREFIXES = [
  'browser_',
  'roxybrowser_playwright__browser_',
  'roxybrowser_playwright_',
  'roxy_open_browsers',
]

function isBrowserTool(toolName: string): boolean {
  return BROWSER_TOOL_PREFIXES.some(prefix => toolName.startsWith(prefix))
}

/**
 * 从 roxy_open_browsers 的返回结果中提取 dirId。
 * 返回格式示例：
 *   **Browser abc123** (PID:456)
 *   - CDP WebSocket: `ws://...`
 */
function extractDirId(result: string): string | undefined {
  // 匹配 "**Browser <dirId>**" 格式
  const match = result.match(/\*\*Browser\s+([\w-]+)\*\*/)
  return match?.[1]
}

/**
 * 从 wrapToolCall 返回值（ToolMessage / Command / 字符串）中提取纯文本内容。
 * LangChain 工具调用返回 ToolMessage，其 .content 可能是：
 *   - string
 *   - Array<{ type: string; text?: string; ... }>（多模态内容块）
 */
function extractResultText(result: unknown): string {
  if (typeof result === 'string')
    return result

  if (result && typeof result === 'object') {
    const msg = result as any
    // ToolMessage / BaseMessage 格式
    if (msg.content !== undefined) {
      const c = msg.content
      if (typeof c === 'string')
        return c
      if (Array.isArray(c)) {
        return c
          .map((block: any) => {
            if (typeof block === 'string')
              return block
            if (block?.text)
              return block.text
            return ''
          })
          .filter(Boolean)
          .join('\n')
      }
    }
    // 兜底：序列化
    try {
      return JSON.stringify(result)
    }
    catch {
      return String(result)
    }
  }
  return String(result)
}

/**
 * 从使用 ref 定位元素的工具入参中提取 DOM context（供后续 Refine 阶段稳定化 locator）。
 * 覆盖 browser_click / browser_type / browser_select_option / browser_hover /
 * browser_drag / browser_fill_form 等使用 elementSchema（含 ref 字段）的工具。
 */
function extractDomContext(toolName: string, input: Record<string, any>): DomContext | undefined {
  const normalized = toolName
    .replace(/^roxybrowser_playwright__/, '')
    .replace(/^roxybrowser_playwright_/, '')

  const REF_TOOLS = [
    'browser_click',
    'browser_type',
    'browser_select_option',
    'browser_hover',
    'browser_drag',
    'browser_fill_form',
  ]
  if (!REF_TOOLS.some(t => normalized.includes(t)))
    return undefined

  // 工具没有传 ref，不需要稳定化
  const rawRef = input.ref || input.element
  if (!rawRef)
    return undefined

  const domContext: DomContext = {}

  domContext.rawLocator = String(rawRef)

  // element 字段是人类可读描述，可作为辅助信息
  if (input.element && input.element !== rawRef)
    domContext.ariaLabel = String(input.element)

  if (input.ariaLabel || input['aria-label'])
    domContext.ariaLabel = String(input.ariaLabel || input['aria-label'])

  return Object.keys(domContext).length > 0 ? domContext : undefined
}

/**
 * 浏览器操作录制中间件。
 *
 * 当存在活跃录制 session 时，旁路记录 browser_* 工具的调用事实（工具名 / 入参 /
 * 返回 / 成功与否 / 耗时 / DOM context / dirId），写入 recordingManager 的事件流，
 * 供后续 Refine / Enhance 阶段生成可零 AI 回放的 Playwright RPA 脚本。
 *
 * 设计要点：
 * - 录制与错误兜底职责分离。本中间件只负责「记录」，不做错误兜底——失败时记录失败事件
 *   后 **rethrow**，由外层 `ToolErrorFallbackMiddleware` 统一把异常转成 ToolMessage
 *   返给 LLM。因此本中间件必须位于 ToolErrorFallback 的**内层**（即 middleware 数组中
 *   排在它之后），才能最先捕获到工具原始异常并记录 success=false。
 * - 非录制状态或非浏览器工具直接放行，零额外开销。
 * - conversationId 由 `createChatAgent` 闭包注入（worker 子进程的 agent.stream config
 *   不携带 conversationId，无法从 request 取），与 workerId 同源。
 */
export function createBrowserRecordingMiddleware(options: {
  conversationId: string
  workerId?: string
}) {
  const { conversationId, workerId } = options

  return createMiddleware({
    name: 'BrowserRecordingMiddleware',
    wrapToolCall: async (request: any, handler: any) => {
      const toolName: string = request?.toolCall?.name ?? ''

      // 非浏览器工具 / 未在录制中：直接放行
      if (!isBrowserTool(toolName) || !recordingManager.isRecording(conversationId))
        return handler(request)

      const inputObj: Record<string, any> = request?.toolCall?.args ?? {}
      const startMs = Date.now()
      let success = true
      let errorMessage: string | undefined
      let resultText = ''

      try {
        const result = await handler(request)
        resultText = extractResultText(result)
        return result
      }
      catch (error: any) {
        success = false
        errorMessage = error instanceof Error ? error.message : String(error)
        resultText = errorMessage
        // 失败操作也记录，供后续脚本生成；rethrow 交给外层 ToolErrorFallback 兜底
        throw error
      }
      finally {
        const durationMs = Date.now() - startMs

        // dirId：roxy_open_browsers 从返回结果解析并确立 primaryDirId；
        // 其他工具继承 session 的 primaryDirId 作为本次操作所属窗口。
        // （appendBrowserOp 内部会在首次收到 dirId 时写入 session.primaryDirId）
        let dirId: string | undefined
        if (toolName.includes('roxy_open_browsers'))
          dirId = extractDirId(resultText)
        else
          dirId = recordingManager.getActiveSession(conversationId)?.primaryDirId

        const domContext = extractDomContext(toolName, inputObj)

        recordingManager.appendBrowserOp(conversationId, {
          toolName,
          input: inputObj,
          result: resultText,
          success,
          errorMessage,
          durationMs,
          domContext,
          dirId,
          workerId,
        })
      }
    },
  })
}
