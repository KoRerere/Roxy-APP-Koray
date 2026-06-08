import type { ImageGenerator } from './types.js'
import { openaiImageGenerator } from './openai.js'
import { seedreamGenerator } from './seedream.js'

export type { ImageGeneratePayload, ImageGenerator, ImageStreamReader, ParsedImageEvent } from './types.js'

export function resolveImageGenerator(imageProtocol?: string): ImageGenerator {
  if (imageProtocol === 'openai')
    return openaiImageGenerator
  return seedreamGenerator
}
