import type { AiAgentRequestOptions } from './aiAgentClient'
import { aiAgentClient } from './aiAgentClient'

export type AiAgentModelApiFormat = 'anthropic' | 'openai' | 'google' | 'moonshot' | string
export type UserModelType = 'text_model' | 'image_model' | 'vlm_model' | 'video_model'

export interface AiAgentModelConfig {
  model?: string
  api_format?: AiAgentModelApiFormat
}

export interface UserModelInfo {
  text_model?: AiAgentModelConfig | null
  vlm_model?: AiAgentModelConfig | null
  image_model?: AiAgentModelConfig | null
  video_model?: AiAgentModelConfig | null
}

export interface UserModelOption extends Required<AiAgentModelConfig> {
  model: string
  api_format: AiAgentModelApiFormat
}

export interface UserModelOptionsResult {
  model_type: UserModelType
  items: UserModelOption[]
}

export interface UserModelSwitchPayload {
  model_type: UserModelType
  model: string | null
}

export class AiAgentModelApi {
  getUserModel(options: AiAgentRequestOptions = {}) {
    return aiAgentClient.get<UserModelInfo>('/v1/user/model', options)
  }

  listUserModelOptions(modelType: UserModelType, options: AiAgentRequestOptions = {}) {
    return aiAgentClient.get<UserModelOptionsResult>('/v1/user/model/options', {
      ...options,
      query: {
        ...options.query,
        model_type: modelType,
      },
    })
  }

  switchUserModel(body: UserModelSwitchPayload, options: AiAgentRequestOptions = {}) {
    return aiAgentClient.put<UserModelInfo>('/v1/user/model', {
      ...options,
      body,
    })
  }
}

export const aiAgentModelApi = new AiAgentModelApi()
