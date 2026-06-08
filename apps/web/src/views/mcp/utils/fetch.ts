import type { SSEParsedEvent } from './sse'
import { parseSSEBlock } from './sse'

interface FetchSSEOptions<T = unknown> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: BodyInit | null
  signal?: AbortSignal
  onEvent?: (evt: SSEParsedEvent<T>) => void
  onError?: (err: unknown) => void
  parseJson?: (data: string) => T
  includeRawBlock?: boolean
}

function safeCallParse<T>(fn: (s: string) => T, s: string): T | null {
  try {
    return fn(s)
  }
  catch {
    return null
  }
}

/**
 * fetch + ReadableStream 解析 SSE
 */
export async function fetchSSE<T = unknown>(
  url: string,
  opts: FetchSSEOptions<T> = {},
): Promise<void> {
  const {
    method = 'GET',
    headers = {},
    body = null,
    signal,
    onEvent,
    onError,
    parseJson,
    includeRawBlock = false,
  } = opts

  const res = await fetch(url, {
    method,
    headers: {
      Accept: 'text/event-stream',
      ...headers,
    },
    body,
    signal,
  })

  if (!res.ok)
    throw new Error(`HTTP ${res.status} ${res.statusText}`)
  if (!res.body)
    throw new Error('ReadableStream not supported in this environment')

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')

  let buffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done)
        break

      buffer += decoder.decode(value, { stream: true })

      let splitIndex: number
      while (true) {
        splitIndex = buffer.search(/\r?\n\r?\n/)
        if (splitIndex === -1)
          break

        const rawBlock = buffer.slice(0, splitIndex)
        buffer = buffer.slice(splitIndex).replace(/^\r?\n\r?\n/, '')

        if (!rawBlock.trim())
          continue

        const { event, id, data, json: defaultJson } = parseSSEBlock<T>(rawBlock)
        const json = parseJson ? safeCallParse(parseJson, data) : defaultJson

        onEvent?.({
          event,
          id,
          data,
          json,
          rawBlock: includeRawBlock ? rawBlock : undefined,
        })
      }
    }
  }
  catch (err) {
    onError?.(err)
    throw err
  }
  finally {
    reader.releaseLock()
  }
}

export function withTimeout(ms: number) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  return { c, cleanup: () => clearTimeout(t) }
}
