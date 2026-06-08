import type { ImageStreamReader, ParsedImageEvent } from './types.js'

type ParseImageEvent = (parsed: unknown, currentIndex: number) => ParsedImageEvent | null

/** 上游在流内透出的错误事件（后端伪流式取数失败时无法再改 HTTP 状态码，改走流内事件）。 */
export class ImageStreamError extends Error {
  code?: string
  status?: number
  constructor(message: string, options?: { code?: string, status?: number }) {
    super(message)
    this.name = 'ImageStreamError'
    this.code = options?.code
    this.status = options?.status
  }
}

// 后端流内错误事件形如：{ "type": "error", "message": "...", "code": "...", "status": 400 }
// 命中即抛出，携带精确 message，避免退化成笼统的 “No generated images returned”。
function throwIfErrorEvent(parsed: unknown): void {
  const p = parsed as any
  if (p && typeof p === 'object' && p.type === 'error') {
    const message = typeof p.message === 'string' && p.message
      ? p.message
      : 'Image generation failed'
    throw new ImageStreamError(message, {
      code: typeof p.code === 'string' ? p.code : undefined,
      status: typeof p.status === 'number' ? p.status : undefined,
    })
  }
}

function* parseSseDataBlock(rawBlock: string) {
  for (const line of rawBlock.split(/\r?\n/)) {
    if (!line.startsWith('data:'))
      continue

    const data = line.slice(5).trim()
    if (!data || data === '[DONE]')
      continue

    try {
      yield JSON.parse(data) as unknown
    }
    catch {
      // Ignore malformed upstream SSE data blocks.
    }
  }
}

export async function* readImageEventStream(
  reader: ImageStreamReader,
  parseEvent: ParseImageEvent,
): AsyncGenerator<ParsedImageEvent> {
  const decoder = new TextDecoder()
  let buffer = ''
  let currentIndex = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done)
      break

    buffer += decoder.decode(value, { stream: true })

    while (true) {
      const boundary = buffer.match(/\r?\n\r?\n/)
      if (!boundary?.[0] || boundary.index === undefined)
        break

      const rawBlock = buffer.slice(0, boundary.index)
      buffer = buffer.slice(boundary.index + boundary[0].length)

      for (const parsed of parseSseDataBlock(rawBlock)) {
        throwIfErrorEvent(parsed)
        const imageEvent = parseEvent(parsed, currentIndex)
        if (!imageEvent)
          continue

        yield imageEvent
        currentIndex = Math.max(currentIndex + 1, imageEvent.image_index + 1)
      }
    }
  }

  buffer += decoder.decode()
  const trailingBlock = buffer.trim()
  if (!trailingBlock)
    return

  for (const parsed of parseSseDataBlock(trailingBlock)) {
    throwIfErrorEvent(parsed)
    const imageEvent = parseEvent(parsed, currentIndex)
    if (!imageEvent)
      continue

    yield imageEvent
    currentIndex = Math.max(currentIndex + 1, imageEvent.image_index + 1)
  }
}
