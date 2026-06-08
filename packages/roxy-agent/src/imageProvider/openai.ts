import type { ImageGeneratePayload, ImageGenerator, ParsedImageEvent } from './types.js'
import { Buffer } from 'node:buffer'
import { aiAgentClient } from '../api/aiAgentClient.js'
import { readImageEventStream } from './stream.js'

function parseOpenAIImageEvent(parsed: unknown, currentIndex: number): ParsedImageEvent | null {
  const p = parsed as any
  if (p?.type !== 'image_generation.completed' || !p.url)
    return null
  return { url: p.url, mime_type: p.mime_type, image_index: currentIndex }
}

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

function extFromMime(mime: string): string {
  return MIME_EXT[mime.toLowerCase().split(';')[0].trim()] ?? 'png'
}

async function referenceImageToBlob(input: string, signal?: AbortSignal): Promise<Blob> {
  if (input.startsWith('data:')) {
    const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(input)
    const mime = match?.[1] || 'image/png'
    const isBase64 = Boolean(match?.[2])
    const dataPart = match?.[3] ?? ''
    const bytes = isBase64
      ? Buffer.from(dataPart, 'base64')
      : Buffer.from(decodeURIComponent(dataPart), 'utf-8')
    return new Blob([bytes], { type: mime })
  }

  const res = await fetch(input, { signal })
  if (!res.ok)
    throw new Error(`Failed to fetch reference image for edit: ${res.status} ${input}`)
  const mime = res.headers.get('content-type') || 'image/png'
  const buffer = await res.arrayBuffer()
  return new Blob([buffer], { type: mime })
}

async function buildEditFormData(payload: ImageGeneratePayload, signal?: AbortSignal): Promise<FormData> {
  const form = new FormData()
  const { image, count, prompt, model, size } = payload

  form.append('prompt', prompt)
  if (model)
    form.append('model', model)
  if (size)
    form.append('size', size)
  if (typeof count === 'number' && count > 0)
    form.append('n', String(count))

  const images = Array.isArray(image) ? image : []
  for (let i = 0; i < images.length; i++) {
    const blob = await referenceImageToBlob(images[i], signal)
    form.append('image[]', blob, `image_${i}.${extFromMime(blob.type || 'image/png')}`)
  }

  return form
}

function buildGenerationsBody(payload: ImageGeneratePayload): Record<string, any> {
  const { count, prompt, model, size } = payload
  const body: Record<string, any> = { prompt }
  if (model)
    body.model = model
  if (size)
    body.size = size
  if (typeof count === 'number' && count > 0)
    body.n = count
  return body
}

// openai provider（如 GPTProto gpt-image-2）：
// - 无参考图 → 文生图 /v1/images/generations（official-format 为 JSON）
// - 有参考图 → 图片编辑 /v1/images/edits（official-format 为 multipart/form-data）
// 上游暂不支持流式输出，故不请求 stream；服务端会非流式取数后再用伪 SSE 逐张推送，下游仍按 readStream 正常消费。
export const openaiImageGenerator: ImageGenerator = {
  async generate(payload: ImageGeneratePayload, signal?: AbortSignal) {
    const hasReferenceImages = Array.isArray(payload.image) && payload.image.length > 0
    if (!hasReferenceImages)
      return aiAgentClient.rawPost('/v1/images/generations', { body: buildGenerationsBody(payload), signal })

    const form = await buildEditFormData(payload, signal)
    return aiAgentClient.rawPost('/v1/images/edits', { body: form, signal })
  },

  readStream(reader) {
    return readImageEventStream(reader, parseOpenAIImageEvent)
  },

  parseEvent: parseOpenAIImageEvent,
}
