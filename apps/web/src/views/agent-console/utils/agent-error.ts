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

export function getAgentErrorCode(data?: AgentErrorData | string | null) {
  return data && typeof data === 'object' && typeof data.code === 'string' ? data.code : undefined
}

export function isAgentCancelledError(data?: AgentErrorData | string | null) {
  if (getAgentErrorCode(data) === 'agent_cancelled')
    return true

  return data && typeof data === 'object' && data.message === 'User cancelled'
}

export function resolveAgentError(data?: AgentErrorData | string | null): ResolvedAgentError {
  if (typeof data === 'string')
    return { message: data || getDefaultMessage(), retryable: false }

  const code = getAgentErrorCode(data)
  const requestId = typeof data?.requestId === 'string' ? data.requestId : undefined
  const codeMessage = getCodeMessage()

  return {
    message: (code && codeMessage[code]) || getDefaultMessage(),
    code,
    retryable: data?.retryable === true,
    requestId,
  }
}
