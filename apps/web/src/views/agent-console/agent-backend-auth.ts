interface UserApiConfigResponse {
  code: number
  data?: {
    apiKey?: string
  }
  msg?: string
}

export function readAgentApiKey(response: UserApiConfigResponse, fallbackMessage: string): string {
  if (response.code !== 0)
    throw new Error(response.msg || fallbackMessage)

  const apiKey = response.data?.apiKey?.trim()
  if (!apiKey)
    throw new Error(fallbackMessage)

  return apiKey
}

export function buildAgentBackendAuthorization(apiKey: string, token: string): string {
  const normalizedApiKey = apiKey.trim()
  const normalizedToken = token.trim()

  if (!normalizedApiKey)
    throw new Error('Agent API Key is unavailable')
  if (!normalizedToken)
    throw new Error('User token is unavailable')

  return `Bearer ${normalizedApiKey}:${normalizedToken}`
}
