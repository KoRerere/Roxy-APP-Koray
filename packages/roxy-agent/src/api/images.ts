import type { AiAgentJsonRequestOptions } from './aiAgentClient'
import { aiAgentClient, resolveAiAgentPath } from './aiAgentClient'

export interface ImageGenerationPayload {
  model?: string
  prompt: string
  size?: string
  watermark?: boolean
  stream?: boolean
  image?: string[]
  sequential_image_generation?: string
  sequential_image_generation_options?: {
    max_images: number
  }
  [key: string]: any
}

export class AiAgentImagesApi {
  /**
   * 调用图片生成接口（流式响应）
   * 返回原始 Response 对象，调用方负责读取 SSE 流
   * @param payload - 图片生成请求参数
   * @param options - 额外请求选项（可传入 signal 用于中断）
   */
  generate(payload: ImageGenerationPayload, options: AiAgentJsonRequestOptions = {}) {
    return aiAgentClient.rawPost('/v1/images/generations', {
      ...options,
      body: payload,
    })
  }

  /**
   * 将图片 URL 解析为完整的可用 URL
   */
  resolveUrl(path?: string | null) {
    return resolveAiAgentPath(path)
  }
}

export const aiAgentImagesApi = new AiAgentImagesApi()
