import type { AiAgentJsonRequestOptions } from './aiAgentClient'
import { aiAgentClient } from './aiAgentClient'

/**
 * 创建脚本入参（snake_case，与后端 Pydantic 对齐）。
 * `file_id` / `oss_url` 在 agent 侧定为必填：仅当 OSS 上传成功（拿到后端 file_id 与
 * oss_url）才构造此 payload 调后端创建接口；OSS 失败时不建后端条目。
 * （后端 Pydantic 暂仍为 Optional，此处类型收紧是 agent 侧的自我约束。）
 */
export interface ScriptCreatePayload {
  name: string
  oss_url: string
  file_id: string
  description?: string
  source?: string
  conversation_id?: string
  recording_id?: string
  dir_id?: string
  options_schema?: string
}

export type ScriptUpdatePayload = Partial<ScriptCreatePayload>

/** 后端返回的脚本记录（camelCase，与后端 _serialize 对齐） */
export interface ScriptRecordDto {
  id: number
  name: string
  description: string | null
  ossUrl: string | null
  fileId: string | null
  source: string
  conversationId: string | null
  recordingId: string | null
  dirId: string | null
  optionsSchema: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface ScriptPage {
  items: ScriptRecordDto[]
  total: number
  limit: number
  offset: number
}

export interface ScriptListParams {
  limit?: number
  offset?: number
  search?: string
  sortBy?: string
  sortOrder?: string
}

/**
 * 后端用户脚本元数据 CRUD（roxy-agent-server /v1/user/scripts）。
 * 鉴权由 aiAgentClient 自动带 Authorization: Bearer {apiKey:token}。
 */
export class AiAgentScriptsApi {
  create(payload: ScriptCreatePayload, options: AiAgentJsonRequestOptions = {}) {
    return aiAgentClient.post<ScriptRecordDto>('/v1/user/scripts', { ...options, body: payload })
  }

  list(params: ScriptListParams = {}, options: AiAgentJsonRequestOptions = {}) {
    return aiAgentClient.get<ScriptPage>('/v1/user/scripts', { ...options, query: { ...params } })
  }

  getById(scriptId: number, options: AiAgentJsonRequestOptions = {}) {
    return aiAgentClient.get<ScriptRecordDto>(`/v1/user/scripts/${scriptId}`, options)
  }

  update(scriptId: number, payload: ScriptUpdatePayload, options: AiAgentJsonRequestOptions = {}) {
    return aiAgentClient.put<ScriptRecordDto>(`/v1/user/scripts/${scriptId}`, { ...options, body: payload })
  }

  delete(scriptId: number, options: AiAgentJsonRequestOptions = {}) {
    return aiAgentClient.delete<null>(`/v1/user/scripts/${scriptId}`, options)
  }
}

export const aiAgentScriptsApi = new AiAgentScriptsApi()
