import { AbortError } from './registry/abortRegistry'

/**
 * Agent 错误归一化。
 *
 * 背景：agent-server 通过 runtime provider 访问上游模型
 * 请求上游的 `llm-proxy`（见 src/config.ts 的 aiAgentUrl）。上游遵循 docs/error_codes.md 定义的
 * 错误信封：`{ code, message, data: { source, category, retryable, request_id, ... } }`。
 *
 * SDK 可能把上游错误包成普通 Error，信封往往只残留在 `error.error`（解析后的 body）
 * 或 `error.message` 内的 JSON 片段里。本模块负责把任意抛出的错误收敛为统一的
 * {@link AgentErrorEnvelope}，前端只需依赖稳定的 `code` 分支、用 `requestId` 上报。
 */

export type AgentErrorSource = 'local' | 'upstream' | 'agent'

/** 归一化后的错误分类，与 docs/error_codes.md 的 `data.category` 对齐。 */
export type AgentErrorCategory
  = | 'invalid_request'
    | 'content_policy'
    | 'billing'
    | 'rate_limit'
    | 'provider_auth'
    | 'provider_quota'
    | 'provider_not_found'
    | 'provider_unavailable'
    | 'provider_timeout'
    | 'cancelled'
    | 'internal'

export interface AgentErrorData {
  /** local：本服务内判定；upstream：上游 provider 返回；agent：agent 自身异常。 */
  source: AgentErrorSource
  category: AgentErrorCategory
  /** 是否建议客户端稍后重试。 */
  retryable: boolean
  /** 排查命脉，对应上游 `data.request_id`，前端报错时回传给客服。 */
  requestId?: string
  provider?: string
  model?: string
  /** 归因后映射出的 HTTP 状态码，仅用于兼容旧前端 / 日志。 */
  httpStatus?: number
  /** 上游原始错误语义，仅供排查，不作为稳定协议。 */
  upstream?: Record<string, unknown>
}

export interface AgentErrorEnvelope {
  /** 稳定业务码，前端据此分支。 */
  code: string
  /** 可读兜底文案。 */
  message: string
  data: AgentErrorData
}

/**
 * 携带上游 HTTP 语义的错误。供伪流式取数（图片生成）等无法再改 HTTP 状态码的场景使用，
 * 把上游状态码与原始 body 透传进归一化流程。
 */
export class AgentUpstreamError extends Error {
  status?: number
  code?: string
  body?: unknown
  requestId?: string

  constructor(message: string, options: { status?: number, code?: string, body?: unknown, requestId?: string } = {}) {
    super(message)
    this.name = 'AgentUpstreamError'
    this.status = options.status
    this.code = options.code
    this.body = options.body
    this.requestId = options.requestId
  }
}

/** 用户取消 / 客户端断开。这类错误不应作为「错误」呈现，调用方通常单独处理。 */
export function isAbortLike(error: unknown): boolean {
  if (AbortError.isAbortError(error)) {
    return true
  }
  const err = error as { name?: string, message?: string } | null
  if (!err) {
    return false
  }
  if (err.name === 'AbortError' || err.name === 'APIUserAbortError') {
    return true
  }
  return typeof err.message === 'string' && /\b(?:abort(?:ed)?|user cancelled|cancell?ed)\b/i.test(err.message)
}

/** undici / Node 传输层网络中断错误码（socket 被提前关闭、空闲断开、读超时等）。 */
const NETWORK_ERROR_CODES = new Set([
  'UND_ERR_SOCKET',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'EPIPE',
  'ETIMEDOUT',
  'ENOTFOUND',
])

/** 传输层中断的消息特征（undici 的 `TypeError: terminated`、`fetch failed`、`other side closed` 等）。 */
const NETWORK_MESSAGE_RE = /\b(?:terminated|fetch failed|other side closed|socket hang ?up|network ?error|connection (?:reset|closed|refused)|premature close)\b/i

/**
 * 判定是否为「传输层网络中断」错误（如 SSE 流被上游/中间设备提前掐断导致 undici `TypeError: terminated`）。
 *
 * 这类错误既无 HTTP 状态码也无业务错误信封，区别于业务/鉴权/限流等可归类错误，应作为**可重试的瞬时网络错误**
 * 处理。供 runtime provider retry 与 {@link normalizeAgentError} 共用，保证「重试判定」与「错误归类」口径一致。
 *
 * 用户主动取消 / 客户端断开（abort）**不算**网络中断，绝不重试。
 */
export function isNetworkError(error: unknown): boolean {
  if (isAbortLike(error)) {
    return false
  }

  let cur: any = error
  const seen = new Set<any>()
  while (cur && typeof cur === 'object' && !seen.has(cur)) {
    seen.add(cur)
    const code = typeof cur.code === 'string' ? cur.code : undefined
    if (code && NETWORK_ERROR_CODES.has(code)) {
      return true
    }
    const message = typeof cur.message === 'string' ? cur.message : ''
    if (message && NETWORK_MESSAGE_RE.test(message)) {
      return true
    }
    // 沿 cause 链下探，兼容底层 HTTP client 的错误包装
    cur = cur.cause
  }
  return false
}

interface CodeSpec {
  category: AgentErrorCategory
  retryable: boolean
}

/**
 * 业务码 → 分类 / 可重试。覆盖 docs/error_codes.md 全部 `code`，外加 agent 自身的兜底码。
 * 当只能拿到上游 `code` 而拿不到 `category` 时，用这张表补全。
 */
const CODE_SPEC: Record<string, CodeSpec> = {
  // 400 invalid_request
  model_not_configured: { category: 'invalid_request', retryable: false },
  model_not_supported: { category: 'invalid_request', retryable: false },
  upstream_invalid_request: { category: 'invalid_request', retryable: false },
  // content_policy
  upstream_content_policy_violation: { category: 'content_policy', retryable: false },
  // 402 billing（用户自身额度）
  insufficient_points: { category: 'billing', retryable: false },
  // 429 rate_limit
  forward_rate_limited: { category: 'rate_limit', retryable: true },
  upstream_rate_limited: { category: 'rate_limit', retryable: true },
  // 503 / 504 provider 侧
  provider_auth_failed: { category: 'provider_auth', retryable: false },
  provider_quota_exceeded: { category: 'provider_quota', retryable: false },
  provider_not_found: { category: 'provider_not_found', retryable: false },
  provider_unavailable: { category: 'provider_unavailable', retryable: true },
  provider_timeout: { category: 'provider_timeout', retryable: true },
  // 传输层网络中断（SSE 流被提前掐断，undici terminated 等）
  network_interrupted: { category: 'provider_unavailable', retryable: true },
  // agent 自身
  agent_internal_error: { category: 'internal', retryable: false },
  agent_cancelled: { category: 'cancelled', retryable: false },
}

/**
 * 仅有 HTTP 状态码时的归因映射，遵循 docs/error_codes.md「HTTP 状态约定」。
 * 同一状态码可能对应多个 code，这里取「最可能 / 对用户最有指导意义」的那个作为默认。
 */
function statusToCode(status: number): string {
  switch (status) {
    case 400:
      return 'upstream_invalid_request'
    case 401:
    case 403:
      return 'provider_auth_failed'
    case 402:
      return 'insufficient_points'
    case 422:
      return 'upstream_invalid_request'
    case 429:
      return 'upstream_rate_limited'
    case 503:
      return 'provider_unavailable'
    case 504:
      return 'provider_timeout'
    default:
      return status >= 500 ? 'provider_unavailable' : 'agent_internal_error'
  }
}

export { statusToCode }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }
  return undefined
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
      return Number(value)
    }
  }
  return undefined
}

/**
 * 从 message 里抠出嵌入的 JSON 片段。上游 SDK 常把响应拼成
 * `"402 {\"code\":\"insufficient_points\",...}"` 这种字符串抛出。
 */
function parseEmbeddedJson(message: string | undefined): Record<string, unknown> | undefined {
  if (!message) {
    return undefined
  }
  const start = message.indexOf('{')
  const end = message.lastIndexOf('}')
  if (start === -1 || end <= start) {
    return undefined
  }
  try {
    const parsed = JSON.parse(message.slice(start, end + 1))
    return isRecord(parsed) ? parsed : undefined
  }
  catch {
    return undefined
  }
}

/** 从 message 开头抠 HTTP 状态码，如 `"402 ..."`、`"429 Too Many Requests"`。 */
function leadingHttpStatus(message: string | undefined): number | undefined {
  const match = message?.trim().match(/^\s*([45]\d{2})\b/)
  return match ? Number(match[1]) : undefined
}

/**
 * 在任意结构里寻找上游错误信封。可能位置：
 * - SDK 解析后的 body：`error.error`（OpenAI/Anthropic SDK 的 APIError.error）
 * - message 内嵌 JSON
 * 信封形如 `{ code, message, request_id, data: {...} }` 或退化的 `{ error: { message, code, type } }`。
 *
 * 新契约（docs/error_codes.md）把追踪 ID 放在信封顶层 `request_id`，与 `data.request_id` 同值；
 * 这里把顶层值一并抽出，交给上层按「顶层 request_id → data.request_id」的优先级取用。
 */
function extractEnvelope(candidate: unknown): {
  code?: string
  message?: string
  requestId?: string
  data?: Record<string, unknown>
  upstreamError?: Record<string, unknown>
} | undefined {
  if (!isRecord(candidate)) {
    return undefined
  }

  // 标准信封：顶层 code + data
  if (typeof candidate.code === 'string' && isRecord(candidate.data)) {
    return {
      code: candidate.code,
      message: firstString(candidate.message),
      requestId: firstString(candidate.request_id, (candidate as { requestId?: unknown }).requestId),
      data: candidate.data,
    }
  }

  // 退化信封：{ error: { message, code, type } }（OpenAI 兼容格式）
  if (isRecord(candidate.error)) {
    const inner = candidate.error
    return {
      code: firstString(inner.code, inner.type),
      message: firstString(inner.message),
      requestId: firstString(candidate.request_id, (candidate as { requestId?: unknown }).requestId),
      upstreamError: inner,
    }
  }

  // 顶层即 { message, code, type }
  if (typeof candidate.message === 'string' && (candidate.code || candidate.type)) {
    return {
      code: firstString(candidate.code, candidate.type),
      message: firstString(candidate.message),
      requestId: firstString(candidate.request_id, (candidate as { requestId?: unknown }).requestId),
      upstreamError: candidate,
    }
  }

  return undefined
}

function specFor(code: string): CodeSpec {
  return CODE_SPEC[code] ?? { category: 'provider_unavailable', retryable: false }
}

/**
 * 把任意抛出的错误收敛为统一信封。优先级：
 *   1. abort / 用户取消 → cancelled
 *   2. 能解析出上游标准信封（顶层 code+data 或 error.*）→ 直接采用上游 code / category / retryable / request_id
 *   3. 只能拿到 HTTP 状态码 → 按状态表反查 code
 *   4. 什么都拿不到 → agent_internal_error
 */
export function normalizeAgentError(error: unknown): AgentErrorEnvelope {
  if (isAbortLike(error)) {
    return {
      code: 'agent_cancelled',
      message: 'Request cancelled',
      data: { source: 'agent', category: 'cancelled', retryable: false },
    }
  }

  // 传输层网络中断：重试耗尽后仍抛出的 terminated 等错误，归一为可重试的 network_interrupted，
  // 前端据此展示「网络异常，请稍后重试」而非迷惑的「内部错误」。须先于信封/状态码解析，因其无信封无状态码。
  if (isNetworkError(error)) {
    return {
      code: 'network_interrupted',
      message: 'Network connection interrupted',
      data: { source: 'upstream', category: 'provider_unavailable', retryable: true },
    }
  }

  const err = (isRecord(error) ? error : {}) as Record<string, unknown>
  const rawMessage = firstString(err.message, typeof error === 'string' ? error : undefined)

  // 候选信封来源：SDK 解析的 body(error.error) > AgentUpstreamError.body > message 内嵌 JSON
  const envelope
    = extractEnvelope(err.error)
      ?? extractEnvelope(err.body)
      ?? extractEnvelope(parseEmbeddedJson(rawMessage))

  const httpStatus = firstNumber(
    err.status,
    (err as { statusCode?: unknown }).statusCode,
    envelope?.data?.status,
    leadingHttpStatus(rawMessage),
  )

  // 情况 2：拿到了上游信封
  if (envelope?.code) {
    const code = envelope.code
    const spec = specFor(code)
    const data = envelope.data ?? {}
    const dataSource = firstString(data.source) as AgentErrorSource | undefined
    const dataCategory = firstString(data.category) as AgentErrorCategory | undefined
    const retryable = typeof data.retryable === 'boolean' ? data.retryable : spec.retryable
    const upstream = isRecord(data.upstream) ? data.upstream : envelope.upstreamError

    return {
      code,
      message: envelope.message ?? rawMessage ?? 'Request failed',
      data: {
        source: dataSource ?? 'upstream',
        category: dataCategory ?? spec.category,
        retryable,
        // 取值优先级遵循 docs/error_codes.md：顶层 request_id → data.request_id → SDK / AgentUpstreamError 字段
        requestId: firstString(
          envelope.requestId,
          data.request_id,
          (data as { requestId?: unknown }).requestId,
          err.requestID,
          (err as { requestId?: unknown }).requestId,
        ),
        provider: firstString(data.provider),
        model: firstString(data.model),
        httpStatus,
        upstream,
      },
    }
  }

  // 情况 3：只有 HTTP 状态码
  if (httpStatus) {
    const code = statusToCode(httpStatus)
    const spec = specFor(code)
    // 上游 5xx/超时归因到 provider 侧（source=upstream）；纯 4xx 校验类多为本地或请求问题
    const source: AgentErrorSource = httpStatus >= 500 ? 'upstream' : 'local'
    return {
      code,
      message: rawMessage ?? `Request failed with status ${httpStatus}`,
      data: {
        source,
        category: spec.category,
        retryable: spec.retryable,
        requestId: firstString(err.requestID, (err as { requestId?: unknown }).requestId),
        httpStatus,
      },
    }
  }

  // 情况 4：兜底
  return {
    code: 'agent_internal_error',
    message: rawMessage ?? 'Internal agent error',
    data: { source: 'agent', category: 'internal', retryable: false },
  }
}
