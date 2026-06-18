// 生图通用参数：只包含与 provider 无关的基本字段。
// provider-specific 字段（如 openai 的 n / seedream 的 sequential_image_generation、watermark、stream）
// 由各 provider 在 generate() 内根据这些通用参数自行翻译。
export interface ImageGeneratePayload {
  model?: string
  prompt: string
  size?: string
  /** 期望生成的图片数量（≥1）；各 provider 翻译成各自上游的字段 */
  count?: number
  /** 参考图（图片编辑场景）：http(s) URL 或 data URL */
  image?: string[]
  conversationId?: string
  turnId?: string
}

export interface ParsedImageEvent {
  url: string
  mime_type?: string
  image_index: number
}

export type ImageStreamReader = ReadableStreamDefaultReader<Uint8Array>

export interface ImageGenerator {
  generate: (payload: ImageGeneratePayload, signal?: AbortSignal) => Promise<Response>
  readStream: (reader: ImageStreamReader) => AsyncGenerator<ParsedImageEvent>
  parseEvent: (parsed: unknown, currentIndex: number) => ParsedImageEvent | null
}
