import { aiAgentToken, aiAgentUrl, env } from '../config'

export interface AiAgentApiResponse<T> {
  code: number
  data: T
  message: string
}

export interface AiAgentBinaryResponse {
  data: ArrayBuffer
  contentType: string | null
  fileName?: string
  response: Response
}

export type AiAgentQueryValue = string | number | boolean | null | undefined
export type AiAgentHeaders = Headers | Record<string, string> | Array<[string, string]>
export type AiAgentBody = string | Blob | FormData | URLSearchParams | ArrayBuffer

export interface AiAgentRequestOptions {
  headers?: AiAgentHeaders
  language?: string
  query?: Record<string, AiAgentQueryValue>
  signal?: AbortSignal
  token?: string
}

export interface AiAgentJsonRequestOptions extends AiAgentRequestOptions {
  body?: AiAgentBody | object | null
}

function buildAiAgentHeaders(options: AiAgentRequestOptions = {}) {
  const headers = new Headers(options.headers)
  const token = options.token ?? aiAgentToken
  const language = options.language ?? env.SYSTEM_LANGUAGE

  if (token && !headers.has('Authorization') && !headers.has('x-api-key'))
    headers.set('Authorization', `Bearer ${token}`)

  if (language && !headers.has('Language') && !headers.has('language'))
    headers.set('Language', language)
  headers.set('ai-agent-version', env.AI_AGENT_VERSION)

  return headers
}

function buildAiAgentUrl(path: string, query?: Record<string, AiAgentQueryValue>) {
  const normalizedPath = /^https?:\/\//i.test(path) ? path : path.replace(/^\/+/, '')
  const url = new URL(normalizedPath, `${aiAgentUrl.replace(/\/+$/, '')}/`)

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '')
        continue
      url.searchParams.set(key, String(value))
    }
  }

  return url.toString()
}

async function extractErrorMessage(response: Response) {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      const payload = await response.json() as Partial<AiAgentApiResponse<unknown>>
      if (typeof payload.message === 'string' && payload.message)
        return payload.message
    }
    catch {
    }
  }

  try {
    const text = await response.text()
    if (text)
      return text
  }
  catch {
  }

  return `${response.status} ${response.statusText}`.trim()
}

function extractFileName(contentDisposition: string | null) {
  if (!contentDisposition)
    return undefined

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    }
    catch {
      return utf8Match[1]
    }
  }

  const plainMatch = contentDisposition.match(/filename="?([^"]+)"?/i)
  return plainMatch?.[1]
}

async function requestJson<T>(
  method: string,
  path: string,
  options: AiAgentJsonRequestOptions = {},
) {
  const requestHeaders = buildAiAgentHeaders(options)
  let body: AiAgentBody | undefined

  if (options.body != null) {
    if (
      typeof options.body === 'string'
      || options.body instanceof Blob
      || options.body instanceof FormData
      || options.body instanceof URLSearchParams
      || options.body instanceof ArrayBuffer
    ) {
      body = options.body
    }
    else {
      if (!requestHeaders.has('Content-Type'))
        requestHeaders.set('Content-Type', 'application/json')
      body = JSON.stringify(options.body)
    }
  }

  const response = await fetch(buildAiAgentUrl(path, options.query), {
    method,
    headers: requestHeaders,
    body,
    signal: options.signal,
  })

  if (!response.ok) {
    throw new Error(`AI Agent request failed: ${await extractErrorMessage(response)}`)
  }

  const payload = await response.json() as AiAgentApiResponse<T>
  if (payload.code !== 0) {
    throw new Error(payload.message || `AI Agent request failed with code ${payload.code}`)
  }

  return payload.data
}

async function requestRaw(
  method: string,
  path: string,
  options: AiAgentJsonRequestOptions = {},
): Promise<Response> {
  const requestHeaders = buildAiAgentHeaders(options)
  let body: AiAgentBody | undefined

  if (options.body != null) {
    if (
      typeof options.body === 'string'
      || options.body instanceof Blob
      || options.body instanceof FormData
      || options.body instanceof URLSearchParams
      || options.body instanceof ArrayBuffer
    ) {
      body = options.body
    }
    else {
      if (!requestHeaders.has('Content-Type'))
        requestHeaders.set('Content-Type', 'application/json')
      body = JSON.stringify(options.body)
    }
  }

  return fetch(buildAiAgentUrl(path, options.query), {
    method,
    headers: requestHeaders,
    body,
    signal: options.signal,
  })
}

async function download(path: string, options: AiAgentRequestOptions = {}): Promise<AiAgentBinaryResponse> {
  const response = await fetch(buildAiAgentUrl(path, options.query), {
    method: 'GET',
    headers: buildAiAgentHeaders(options),
    signal: options.signal,
  })

  if (!response.ok) {
    throw new Error(`AI Agent download failed: ${await extractErrorMessage(response)}`)
  }

  return {
    data: await response.arrayBuffer(),
    contentType: response.headers.get('content-type'),
    fileName: extractFileName(response.headers.get('content-disposition')),
    response,
  }
}

export function resolveAiAgentPath(path?: string | null) {
  if (!path)
    return undefined
  return buildAiAgentUrl(path)
}

export const aiAgentClient = {
  buildUrl: buildAiAgentUrl,
  delete: <T>(path: string, options?: AiAgentJsonRequestOptions) => requestJson<T>('DELETE', path, options),
  download,
  get: <T>(path: string, options?: AiAgentJsonRequestOptions) => requestJson<T>('GET', path, options),
  post: <T>(path: string, options?: AiAgentJsonRequestOptions) => requestJson<T>('POST', path, options),
  put: <T>(path: string, options?: AiAgentJsonRequestOptions) => requestJson<T>('PUT', path, options),
  rawGet: (path: string, options?: AiAgentJsonRequestOptions) => requestRaw('GET', path, options),
  rawPost: (path: string, options?: AiAgentJsonRequestOptions) => requestRaw('POST', path, options),
}
