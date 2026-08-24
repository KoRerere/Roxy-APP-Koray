/**
 * Agent 错误码 → 展示文案映射。
 *
 * 与旧 /mcp 对话页保持一致：error 事件优先按稳定 code 展示本地化文案，
 * 同时保留 requestId 供用户复制给技术支持。
 */

function getCodeMessage(): Record<string, string> {
  return {
    model_not_configured: $t('模型不支持。'),
    model_not_supported: $t('模型不支持，请尝试将 APP 更到最新版本，或者重启 Roxy AI Agent 窗口'),
    upstream_invalid_request: $t('请求参数有误，请调整后重试。'),
    upstream_content_policy_violation: $t('内容涉及敏感信息，请修改描述后重试。'),
    insufficient_points: $t('您的积分不足，请充值积分后重试。'),
    forward_rate_limited: $t('您的积分不足，请充值积分后重试。'),
    upstream_rate_limited: $t('服务暂时不可用，请联系技术支持'),
    provider_auth_failed: $t('服务暂时不可用，请稍后重试或联系技术支持。'),
    provider_quota_exceeded: $t('服务额度暂时不可用，请稍后重试或联系技术支持。'),
    provider_not_found: $t('服务配置异常，请联系技术支持。'),
    provider_unavailable: $t('服务暂时不可用，请稍后重试。'),
    provider_timeout: $t('服务响应超时，请稍后重试。'),
    network_interrupted: $t('网络异常，请稍后重试。'),
    agent_internal_error: $t('未知错误，请联系技术支持。'),
  }
}

function getDefaultMessage() {
  return $t('未知错误，请联系技术支持。')
}

export type AgentErrorData = Record<string, unknown>

export interface ResolvedAgentError {
  message: string
  code?: string
  retryable: boolean
  requestId?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim())
      return value
  }
}

function normalizeErrorCode(code: unknown, message?: string): string | undefined {
  if (typeof code === 'string' && code.trim()) {
    if (/^\d+$/.test(code.trim()))
      return normalizeErrorCode(Number(code), message)
    return code
  }

  const lowerMessage = message?.toLowerCase() ?? ''
  if (code === 402 || lowerMessage.includes('insufficient points') || lowerMessage.includes('points balance is insufficient') || message?.includes('积分不足'))
    return 'insufficient_points'

  if (code === 429)
    return 'upstream_rate_limited'

  return undefined
}

function extractErrorFields(data?: AgentErrorData | string | null): {
  code?: string
  message?: string
  requestId?: string
  retryable?: boolean
} {
  if (!isRecord(data))
    return {}

  const response = isRecord(data.response) ? data.response : undefined
  const responseData = response && isRecord(response.data) ? response.data : undefined
  const nestedError = isRecord(data.error) ? data.error : undefined
  const source = responseData ?? nestedError ?? data
  const message = firstString(
    source.message,
    data.message,
    response?.message,
    responseData?.message,
    nestedError?.message,
  )
  const code = normalizeErrorCode(
    source.code ?? data.code ?? response?.status ?? responseData?.status ?? nestedError?.code,
    message,
  )

  return {
    code,
    message,
    requestId: firstString(
      source.requestId,
      source.request_id,
      data.requestId,
      data.request_id,
      data.requestID,
      response?.requestID,
      response?.requestId,
      responseData?.requestId,
      responseData?.request_id,
      nestedError?.requestID,
      nestedError?.requestId,
      nestedError?.request_id,
    ),
    retryable: typeof source.retryable === 'boolean'
      ? source.retryable
      : typeof responseData?.retryable === 'boolean'
        ? responseData.retryable
        : typeof data.retryable === 'boolean'
          ? data.retryable
          : undefined,
  }
}

export function getAgentErrorCode(data?: AgentErrorData | string | null) {
  return extractErrorFields(data).code
}

export function isAgentCancelledError(data?: AgentErrorData | string | null) {
  if (getAgentErrorCode(data) === 'agent_cancelled')
    return true

  return data && typeof data === 'object' && data.message === 'User cancelled'
}

export function resolveAgentError(data?: AgentErrorData | string | null): ResolvedAgentError {
  if (typeof data === 'string')
    return { message: data || getDefaultMessage(), retryable: false }

  const fields = extractErrorFields(data)
  const code = fields.code
  const requestId = fields.requestId
  const codeMessage = getCodeMessage()

  return {
    message: (code && codeMessage[code]) || fields.message || getDefaultMessage(),
    code,
    retryable: fields.retryable === true,
    requestId,
  }
}
