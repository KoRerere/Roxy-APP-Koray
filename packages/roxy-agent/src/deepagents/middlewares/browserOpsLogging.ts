import type { DomContext } from '@/script/types'
import { createMiddleware } from 'langchain'
import { publishTaskMonitorBrowserAttached, publishTaskMonitorBrowserEvent } from '@/core/task-monitor'
import { conversationLogManager } from '@/script/browserOpsManager'

/** browser_* 工具名前缀（含 roxybrowser_playwright 命名空间） */
const BROWSER_TOOL_PREFIXES = [
  'browser_',
  'roxybrowser_playwright__browser_',
  'roxybrowser_playwright_',
  'roxy_browser_',
  'roxy_open_browsers',
]

interface OpenedBrowserEntry {
  dirId: string
  ws?: string
  browserType?: string
}

function isBrowserTool(toolName: string): boolean {
  return BROWSER_TOOL_PREFIXES.some(prefix => toolName.startsWith(prefix))
}

function isBrowserOpenTool(toolName: string): boolean {
  const normalized = toolName.toLowerCase()
  return normalized.includes('roxy_browser_open')
    || normalized.includes('roxy_open_browsers')
}

function isBrowserLaunchTool(toolName: string): boolean {
  return toolName.toLowerCase().includes('roxy_browser_launch')
}

function isBrowserConnectTool(toolName: string): boolean {
  const normalized = toolName.toLowerCase()
  return normalized.includes('roxy_browser_connect')
    || normalized.includes('roxy_browser_launch')
    || normalized.includes('browser_connect')
    || normalized.includes('connect_browser')
    || normalized.includes('roxy_open_browsers')
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
  if (match?.[1])
    return match[1]

  const jsonLike = result.match(/["']dirId["']\s*:\s*["']([\w-]+)["']/)
  if (jsonLike?.[1])
    return jsonLike[1]

  const labelLike = result.match(/\bdir[_-]?id\s*[:=]\s*`?([\w-]+)`?/i)
  return labelLike?.[1]
}

function extractDirIdFromUrl(result: string): string | undefined {
  const idParam = result.match(/[?&]id=([\w-]+)/i)
  return idParam?.[1]
}

function extractBrowserWs(result: string): string | undefined {
  return result.match(/wss?:\/\/[^\s`'")]+/)?.[0]
}

function extractBrowserType(result: string): string | undefined {
  if (/firefox/i.test(result))
    return 'firefox'
  if (/chrom(?:e|ium)/i.test(result))
    return 'chromium'
  return undefined
}

export function normalizeBrowserEndpoint(endpoint: string | undefined): string | undefined {
  const cleaned = endpoint
    ?.trim()
    .replace(/^[`'"]+/, '')
    .replace(/[`'".,;)\]]+$/, '')
  if (!cleaned)
    return undefined

  try {
    const url = new URL(cleaned)
    url.protocol = url.protocol.toLowerCase()
    url.hostname = url.hostname.toLowerCase()
    return url.toString()
  }
  catch {
    return cleaned
  }
}

export function extractBrowserOpenEntries(result: string): OpenedBrowserEntry[] {
  const entries: OpenedBrowserEntry[] = []
  const fallbackBrowserType = extractBrowserType(result)
  const blockPattern = /\*\*Browser\s+([\w-]+)\*\*([\s\S]*?)(?=\n\s*\*\*Browser\s+[\w-]+\*\*|$)/g

  for (const match of result.matchAll(blockPattern)) {
    const dirId = match[1]
    const block = match[0]
    if (!dirId)
      continue

    entries.push({
      dirId,
      ws: extractBrowserWs(block),
      browserType: extractBrowserType(block) ?? fallbackBrowserType,
    })
  }

  return entries
}

function findStringKey(value: unknown, keys: string[], depth = 0): string | undefined {
  if (!value || typeof value !== 'object' || depth > 3)
    return undefined

  const record = value as Record<string, unknown>
  for (const key of keys) {
    const direct = record[key]
    if (typeof direct === 'string' && direct.trim())
      return direct.trim()
    if (typeof direct === 'number')
      return String(direct)
  }

  for (const child of Object.values(record)) {
    const found = findStringKey(child, keys, depth + 1)
    if (found)
      return found
  }

  return undefined
}

function normalizeToolInput(input: unknown): Record<string, any> {
  if (!input)
    return {}

  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed)
      return {}
    try {
      const parsed = JSON.parse(trimmed)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, any> : { value: parsed }
    }
    catch {
      return { value: trimmed }
    }
  }

  return typeof input === 'object' && !Array.isArray(input) ? input as Record<string, any> : { value: input }
}

function extractDirIdFromInput(input: Record<string, any>): string | undefined {
  return findStringKey(input, ['dirId', 'dir_id', 'browserId', 'browser_id', 'profileId', 'windowId'])
}

function sanitizeForMonitor(input: Record<string, any>): Record<string, unknown> {
  const SENSITIVE_KEYS = /password|token|cookie|authorization|secret|apikey|api_key/i
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      SENSITIVE_KEYS.test(key) ? '[REDACTED]' : value,
    ]),
  )
}

function getMonitorBrowserId(connectTool: boolean, dirId: string | undefined, endpoint: string | undefined): string | undefined {
  return dirId ?? (connectTool ? endpoint : undefined)
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
 * 从使用 ref 定位元素的工具入参中提取 DOM context（供后续脚本编写流程稳定化 locator）。
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
 * 浏览器操作日志中间件。
 *
 * 当存在操作日志 session 时，旁路记录 browser_* 工具的调用事实（工具名 / 入参 /
 * 返回 / 成功与否 / 耗时 / DOM context / dirId），写入 conversationLogManager 的事件流，
 * 供后续脚本编写流程生成可零 AI 回放的 Playwright RPA 脚本。
 *
 * 设计要点：
 * - 操作日志与错误兜底职责分离。本中间件只负责「记录」，不做错误兜底——失败时记录失败事件
 *   后 **rethrow**，由外层 `ToolErrorFallbackMiddleware` 统一把异常转成 ToolMessage
 *   返给 LLM。因此本中间件必须位于 ToolErrorFallback 的**内层**（即 middleware 数组中
 *   排在它之后），才能最先捕获到工具原始异常并记录 success=false。
 * - 非操作日志状态或非浏览器工具直接放行，零额外开销。
 * - conversationId 由 `createChatAgent` 闭包注入（worker 子进程的 agent.stream config
 *   不携带 conversationId，无法从 request 取），与 workerId 同源。
 */
export function createBrowserOpsLoggingMiddleware(options: {
  conversationId?: string
  workerId?: string
  taskId?: string
}) {
  const { conversationId, workerId, taskId } = options
  const openedBrowserByEndpoint = new Map<string, OpenedBrowserEntry>()

  function rememberOpenedBrowsers(result: string): void {
    const entries = extractBrowserOpenEntries(result)
    for (const entry of entries) {
      const endpointKey = normalizeBrowserEndpoint(entry.ws)
      if (endpointKey)
        openedBrowserByEndpoint.set(endpointKey, entry)
    }
  }

  function resolveOpenedBrowser(endpoint: string | undefined): OpenedBrowserEntry | undefined {
    const endpointKey = normalizeBrowserEndpoint(endpoint)
    return endpointKey ? openedBrowserByEndpoint.get(endpointKey) : undefined
  }

  return createMiddleware({
    name: 'BrowserOperationLogMiddleware',
    wrapToolCall: async (request: any, handler: any) => {
      const toolName: string = request?.toolCall?.name ?? ''

      const canRecordOps = Boolean(conversationId && conversationLogManager.canAppendEvents(conversationId))
      const canMonitor = Boolean(taskId)
      const browserTool = isBrowserTool(toolName)

      // 非浏览器工具 / 未启用操作日志和监控：直接放行
      if (!browserTool || (!canRecordOps && !canMonitor))
        return handler(request)

      const inputObj = normalizeToolInput(request?.toolCall?.args)
      const startMs = Date.now()
      let success = true
      let errorMessage: string | undefined
      let resultText = ''
      const connectTool = isBrowserConnectTool(toolName)
      const launchTool = isBrowserLaunchTool(toolName)
      let dirId = extractDirIdFromInput(inputObj)
        ?? (conversationId ? conversationLogManager.getSession(conversationId)?.primaryDirId : undefined)
      const monitorInput = sanitizeForMonitor(inputObj)
      const endpoint = findStringKey(inputObj, ['endpoint', 'ws', 'url'])
      const openedBrowser = resolveOpenedBrowser(endpoint)
      dirId = dirId ?? openedBrowser?.dirId
      const startBrowserId = getMonitorBrowserId(connectTool, dirId, endpoint)

      if (taskId) {
        if (connectTool && !launchTool && startBrowserId) {
          publishTaskMonitorBrowserAttached({
            taskId,
            browserId: startBrowserId,
            dirId,
            label: dirId ?? startBrowserId,
            ws: openedBrowser?.ws ?? endpoint,
            browserType: openedBrowser?.browserType,
          })
        }

        publishTaskMonitorBrowserEvent({
          taskId,
          browserId: startBrowserId,
          dirId,
          stage: 'start',
          toolName,
          input: monitorInput,
          success: true,
          workerId,
          conversationId,
          timestamp: startMs,
        })
      }

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
        if (isBrowserOpenTool(toolName) && success)
          rememberOpenedBrowsers(resultText)

        const resolvedOpenedBrowser = resolveOpenedBrowser(endpoint)
        if (connectTool)
          dirId = extractDirIdFromInput(inputObj) ?? resolvedOpenedBrowser?.dirId ?? extractDirId(resultText) ?? extractDirIdFromUrl(resultText) ?? dirId
        else if (!dirId)
          dirId = conversationId ? conversationLogManager.getSession(conversationId)?.primaryDirId : undefined
        const monitorBrowserId = getMonitorBrowserId(connectTool, dirId, endpoint)

        const domContext = extractDomContext(toolName, inputObj)

        if (taskId) {
          if (connectTool && success && monitorBrowserId) {
            publishTaskMonitorBrowserAttached({
              taskId,
              browserId: monitorBrowserId,
              dirId,
              label: dirId ?? monitorBrowserId,
              ws: extractBrowserWs(resultText) ?? resolvedOpenedBrowser?.ws ?? endpoint,
              browserType: extractBrowserType(resultText) ?? resolvedOpenedBrowser?.browserType,
            })
          }

          publishTaskMonitorBrowserEvent({
            taskId,
            browserId: monitorBrowserId,
            dirId,
            stage: success ? 'end' : 'error',
            toolName,
            input: monitorInput,
            result: resultText,
            success,
            errorMessage,
            durationMs,
            workerId,
            conversationId,
            timestamp: Date.now(),
          })
        }

        if (canRecordOps && conversationId) {
          conversationLogManager.appendBrowserOp(conversationId, {
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
      }
    },
  })
}
