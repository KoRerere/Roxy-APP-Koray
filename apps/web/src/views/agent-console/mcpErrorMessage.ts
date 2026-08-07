type McpMessageFactory = () => string

export type McpTransportType = 'stdio' | 'http'
export type McpConfigOperation = 'save' | 'validate'

const mcpConfigFallbackMessages: Record<McpConfigOperation, Record<McpTransportType, McpMessageFactory>> = {
  save: {
    http: () => $t('MCP 服务保存失败，请检查名称、URL 和 HTTP 请求头后重试'),
    stdio: () => $t('MCP 服务保存失败，请检查名称、命令和环境变量后重试'),
  },
  validate: {
    http: () => $t('MCP 服务验证失败，请检查名称、URL 和 HTTP 请求头后重试'),
    stdio: () => $t('MCP 服务验证失败，请检查名称、命令和环境变量后重试'),
  },
}

function stringifyMcpError(error: unknown): string {
  if (typeof error === 'string')
    return error

  if (error instanceof Error)
    return error.message

  if (error && typeof error === 'object') {
    const payload = error as Record<string, unknown>
    const nestedError = payload.error ?? payload.msg ?? payload.message
    if (nestedError !== undefined && nestedError !== error)
      return stringifyMcpError(nestedError)

    try {
      return JSON.stringify(error)
    }
    catch {
      return ''
    }
  }

  return ''
}

/**
 * 将 MCP SDK、Zod 和网络层的底层异常收敛为产品可控的错误文案。
 * 未识别的错误不会直接透传，避免把堆栈、配置或结构化校验信息暴露到界面。
 */
export function getMcpErrorMessage(
  error: unknown,
  fallbackMessage: McpMessageFactory = () => $t('MCP 服务操作失败，请稍后重试'),
): string {
  const message = stringifyMcpError(error).toLowerCase()

  if (
    message.includes('"validation":"url"')
    || message.includes('"validation": "url"')
    || message.includes('invalid url')
    || message.includes('invalid_url')
    || message.includes('url is invalid')
  ) {
    return $t('URL格式有误，必须以 http:// 或 https:// 开头')
  }

  if (
    message.includes('requires "url"')
    || message.includes('url is required')
    || message.includes('missing url')
  ) {
    return $t('URL 必须填写')
  }

  if (
    message.includes('requires "command"')
    || message.includes('command is required')
    || message.includes('missing command')
  ) {
    return $t('命令必须填写')
  }

  if (
    /\b401\b/.test(message)
    || message.includes('unauthorized')
    || message.includes('authentication failed')
    || message.includes('invalid token')
    || message.includes('invalid api key')
  ) {
    return $t('MCP 身份验证失败，请检查 HTTP 请求头中的认证信息')
  }

  if (
    /\b403\b/.test(message)
    || message.includes('forbidden')
    || message.includes('permission denied')
  ) {
    return $t('MCP 服务拒绝访问，请检查访问权限')
  }

  if (
    /\b404\b/.test(message)
    || message.includes('not found')
  ) {
    return $t('MCP 服务地址不存在，请检查 URL 是否正确')
  }

  if (
    message.includes('timeout')
    || message.includes('timed out')
    || message.includes('etimedout')
    || message.includes('aborterror')
  ) {
    return $t('MCP 服务连接超时，请稍后重试')
  }

  if (
    message.includes('econnrefused')
    || message.includes('connection refused')
    || message.includes('enotfound')
    || message.includes('getaddrinfo')
    || message.includes('fetch failed')
    || message.includes('failed to fetch')
    || message.includes('network error')
    || message.includes('certificate')
    || message.includes('self signed')
    || message.includes('tls')
    || message.includes('ssl')
  ) {
    return $t('MCP 服务无法访问，请检查 URL 和网络连接')
  }

  if (
    /\b5\d{2}\b/.test(message)
    || message.includes('internal server error')
    || message.includes('bad gateway')
    || message.includes('service unavailable')
  ) {
    return $t('MCP 服务暂时不可用，请稍后重试')
  }

  if (
    message.includes('unsupported protocol')
    || message.includes('unsupported transport')
    || message.includes('invalid response')
    || message.includes('unexpected response')
    || message.includes('content-type')
    || message.includes('streamable')
    || message.includes('protocol error')
  ) {
    return $t('MCP 服务响应格式不支持，请确认服务支持 Streamable HTTP')
  }

  return fallbackMessage()
}

export function getMcpConfigErrorMessage(
  error: unknown,
  transport: McpTransportType,
  operation: McpConfigOperation = 'validate',
): string {
  return getMcpErrorMessage(error, mcpConfigFallbackMessages[operation][transport])
}

export function isValidMcpHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  }
  catch {
    return false
  }
}
