import type { ImageGeneratePayload, ImageGenerator, ParsedImageEvent } from './types.js'
import { aiAgentClient } from '../api/aiAgentClient.js'
import { readImageEventStream } from './stream.js'

function parseSeedreamImageEvent(parsed: unknown, currentIndex: number): ParsedImageEvent | null {
  const p = parsed as any
  if (p?.type !== 'image_generation.partial_succeeded' || !p.url)
    return null
  return {
    url: p.url,
    mime_type: p.mime_type,
    image_index: Number.isFinite(Number(p.image_index)) ? Number(p.image_index) : currentIndex,
  }
}

// 把通用参数翻译成 seedream（火山）上游字段：
// - 多图通过 sequential_image_generation='auto' + max_images 控制
// - 固定关闭水印，并请求流式输出（seedream 上游支持真流式）
function buildSeedreamBody(payload: ImageGeneratePayload) {
  const { count, ...rest } = payload
  const body: Record<string, any> = {
    ...rest,
    watermark: false,
    stream: true,
  }
  if (typeof count === 'number' && count > 1) {
    body.sequential_image_generation = 'auto'
    body.sequential_image_generation_options = { max_images: count }
  }
  return body
}

export const seedreamGenerator: ImageGenerator = {
  generate(payload: ImageGeneratePayload, signal?: AbortSignal) {
    return aiAgentClient.rawPost('/v1/images/generations', { body: buildSeedreamBody(payload), signal })
  },

  readStream(reader) {
    return readImageEventStream(reader, parseSeedreamImageEvent)
  },

  parseEvent: parseSeedreamImageEvent,
}
