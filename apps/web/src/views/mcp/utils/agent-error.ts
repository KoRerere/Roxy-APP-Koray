/**
 * Agent 错误码 → 展示文案映射。
 *
 * 后端（roxy-agent）按 docs/error_codes.md 下发统一错误信封，error 事件的 data 形如：
 *   { code, category, message, retryable, requestId?, httpStatus?, source }
 *
 * 前端优先用稳定的 `code` 分支取文案；拿不到 code（历史 .sse 回放等）时回退到 `httpStatus`/`errorCode`。
 *
 * 文案用 `$t()` 包裹，以便 `pnpm genLanguage` 静态扫描提取并生成 en/ru 翻译。
 * 切换语言会触发整页 reload（见 stores/locale.ts），故模块顶层 eager 求值不存在 stale 问题。
 */

import { $t } from '/@/locales'
import type { SSEEventData } from '../types'

/** 稳定业务码 → 文案 */
const CODE_MESSAGE: Record<string, string> = {
  // invalid_request
  model_not_configured: $t('模型未配置，请联系技术支持。'),
  model_not_supported: $t('模型不支持，请尝试将 APP 更到最新版本，或者重启 Roxy AI Agent 窗口'),
  upstream_invalid_request: $t('请求参数有误，请调整后重试。'),
  // content_policy
  upstream_content_policy_violation: $t('内容涉及敏感信息，请修改描述后重试。'),
  // billing（用户自身额度）
  insufficient_balance: $t('您的 Roxy AI Agent 请求已达上限，如需调整体验额度，请与我们的技术支持联系。'),
  insufficient_points: $t('您的积分不足，请充值后重试。'),
  insufficient_image_quota: $t('图片生成次数已用完，如需继续使用，请联系技术支持。'),
  // rate_limit
  forward_rate_limited: $t('您的 Roxy AI Agent 请求过于频繁，请稍后重试。'),
  upstream_rate_limited: $t('您的 Roxy AI Agent 请求过于频繁，请稍后重试。'),
  // provider 侧（非用户可处理）
  provider_auth_failed: $t('服务暂时不可用，请稍后重试或联系技术支持。'),
  provider_quota_exceeded: $t('服务额度暂时不可用，请稍后重试或联系技术支持。'),
  provider_not_found: $t('服务配置异常，请联系技术支持。'),
  provider_unavailable: $t('服务暂时不可用，请稍后重试。'),
  provider_timeout: $t('服务响应超时，请稍后重试。'),
  // agent 自身
  agent_internal_error: $t('未知错误，请联系技术支持。'),
  agent_cancelled: $t('请求已取消。'),
}

/** 旧 HTTP 状态码 → 文案（兼容历史 .sse 回放与旧前端字段；新链路已改用上面的 code 分支） */
const STATUS_MESSAGE: Record<number, string> = {
  400: $t('模型不支持，请尝试将 APP 更到最新版本，或者重启 Roxy AI Agent 窗口'),
  402: $t('您的 Roxy AI Agent 请求已达上限，如需调整体验额度，请与我们的技术支持联系。'),
  403: $t('图片生成次数已用完，如需继续使用，请联系技术支持。'),
  406: $t('图片内容涉及敏感信息，请修改描述后重试。'),
  429: $t('您的 Roxy AI Agent 请求过于频繁，请稍后重试。'),
  504: $t('额度限制，如需体验额度，请联系技术支持。'),
}

const DEFAULT_MESSAGE = $t('未知错误，请联系技术支持。')

export type AgentErrorData = NonNullable<SSEEventData['data']>

export interface ResolvedAgentError {
  /** 已翻译的展示文案 */
  message: string
  code?: string
  retryable: boolean
  requestId?: string
}

/**
 * 把 error 事件的 data 收敛为展示所需信息。
 * 优先级：code → httpStatus/errorCode → 默认兜底。
 */
export function resolveAgentError(data?: AgentErrorData | string | null): ResolvedAgentError {
  // 极旧路径：data 直接是字符串（onError 兜底塞入的纯文本）
  if (typeof data === 'string') {
    return { message: data || DEFAULT_MESSAGE, retryable: false }
  }

  const code = data?.code
  const status = data?.httpStatus ?? data?.errorCode

  const message
    = (code && CODE_MESSAGE[code])
      || (status != null && STATUS_MESSAGE[status])
      || DEFAULT_MESSAGE

  return {
    message,
    code,
    retryable: data?.retryable ?? false,
    requestId: data?.requestId,
  }
}
