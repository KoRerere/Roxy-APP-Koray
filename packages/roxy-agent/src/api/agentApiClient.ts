import type {
  ListOfficialTemplatesData,
  OfficialTemplateInfo,
  OfficialTemplatePage,
  TemplateSkillAssetInfo,
  UpstreamUploadedFileInfo,
  UserTemplateCreate,
  UserTemplateInfo,
} from '@roxy/agent-api'
import {
  FilesApi,
  HttpClient,
  OfficialScriptsApi,
  PlanTypeEnum,
  TemplatesApi,
  UserApi,
  UserTasksApi,
  UserTemplatesApi,
} from '@roxy/agent-api'
import { aiAgentToken, aiAgentUrl, env } from '../config'
import { AiAgentHttpError } from './errors'
import { installAxiosGetRetryInterceptor } from './getRetry'

/**
 * roxy-agent-server 统一响应信封：{ code, data, message }，code === 0 为成功。
 * @roxy/agent-api 的方法返回 axios response.data，即整个信封（未 unwrap）。
 */
interface AgentApiResponse<T> {
  code: number
  data: T
  message: string
}

/**
 * 基于 @roxy/agent-api 的 HttpClient，统一承载 Agent 后端的非 LLM 接口。
 * - baseURL = aiAgentUrl（${ROXY_SERVER_URL}/llm-proxy）
 * - Authorization: Bearer ${aiAgentToken}（${ROXY_API_KEY}:${ROXY_USER_TOKEN}）
 * - WorkspaceID / Language / ai-agent-version 统一由请求拦截器注入
 * LLM 请求由 runtime provider 直接访问 /llm-proxy。
 */
const httpClient = new HttpClient({
  baseURL: aiAgentUrl,
  timeout: 15000,
})

const FILE_UPLOAD_TIMEOUT_MS = 10 * 60 * 1000

httpClient.instance.interceptors.request.use((config) => {
  Object.assign(config.headers, {
    'Authorization': `Bearer ${aiAgentToken}`,
    'WorkspaceID': env.ROXY_WORKSPACE_ID,
    'ai-agent-version': env.AI_AGENT_VERSION,
  })
  // Language 仅在调用方未指定时用系统默认。
  if (!config.headers.Language) {
    config.headers.Language = env.SYSTEM_LANGUAGE
  }
  return config
}, (error) => {
  return Promise.reject(error)
})

installAxiosGetRetryInterceptor(httpClient.instance, {
  shouldRetryResponse: (response) => {
    const payload = response.data as { code?: unknown } | undefined
    return payload?.code === 'service_unavailable'
  },
})

/**
 * HTTP 错误（4xx/5xx）转 AiAgentHttpError，供任务和路由调用方按状态码
 * 区分可重试错误与上游失败。
 */
httpClient.instance.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    const status = error?.response?.status
    if (typeof status === 'number') {
      const payload = error.response.data
      const message = payload?.message || payload?.msg || `${status} ${error.response.statusText ?? ''}`.trim()
      return Promise.reject(new AiAgentHttpError(status, message, { payload }))
    }
    return Promise.reject(error)
  },
)

/**
 * unwrap 后端响应：code !== 0 抛 AiAgentHttpError，否则返回 data。
 * 调用方拿到的已是 data 字段。
 */
async function unwrap<T>(p: Promise<AgentApiResponse<T>>): Promise<T> {
  const res = await p
  if (res.code !== 0) {
    throw new AiAgentHttpError(
      200,
      res.message || `AI Agent request failed with code ${res.code}`,
      { code: res.code, payload: res },
    )
  }
  return res.data
}

const officialScriptsApi = new OfficialScriptsApi(httpClient)
const templatesApi = new TemplatesApi(httpClient)
const filesApi = new FilesApi(httpClient)
const userApi = new UserApi(httpClient)
const userTasksApi = new UserTasksApi(httpClient)
const userTemplatesApi = new UserTemplatesApi(httpClient)

export type FileUploadResult = UpstreamUploadedFileInfo

export interface FileUploadOptions {
  forward?: boolean
  model?: string
}

/**
 * 官方脚本只读接口（GET /v1/official/scripts）。
 * 官方脚本包含多语言字段，与用户脚本 DTO 不同；调用方保留 unknown 并按场景归一化。
 */
export const agentOfficialScriptsApi = {
  getBySlug(slug: string): Promise<unknown> {
    return unwrap(officialScriptsApi.getOfficialScript({ scriptIdOrSlug: slug }))
  },
}

export const agentTemplatesApi = {
  async listAll(): Promise<OfficialTemplateInfo[]> {
    const data = await unwrap<ListOfficialTemplatesData['data']>(templatesApi.listOfficialTemplates({}))
    return Array.isArray(data) ? data : data.items
  },
  async listPage(params: { limit: number, offset: number }): Promise<OfficialTemplatePage> {
    const result = await unwrap<ListOfficialTemplatesData['data']>(templatesApi.listOfficialTemplates(params))
    if (Array.isArray(result)) {
      return {
        items: result,
        total: result.length,
        limit: params.limit,
        offset: params.offset,
      }
    }
    return result
  },
  getById(templateIdOrSlug: string | number): Promise<OfficialTemplateInfo> {
    return unwrap(templatesApi.getOfficialTemplate({ templateIdOrSlug: String(templateIdOrSlug) }))
  },
}

/**
 * 文件上传（POST /v3/files/upload）。所有文件保存 OSS；forward=true 时再转发到模型对应的文件服务。
 * 预构造 FormData 以保留文件名，并复用 @roxy/agent-api 生成的 v3 方法。
 */
export const agentFilesApi = {
  upload(file: Blob, fileName: string, options: FileUploadOptions = {}): Promise<FileUploadResult> {
    const formData = new FormData()
    formData.append('file', file, fileName)
    formData.append('forward', String(options.forward ?? false))
    if (options.model) {
      formData.append('model', options.model)
    }
    return unwrap<FileUploadResult>(filesApi.uploadFileV3V3FilesUploadPost(
      formData as never,
      { timeout: FILE_UPLOAD_TIMEOUT_MS },
    ))
  },
}

// ── 用户模型相关类型 ──
export type AiAgentModelApiFormat = 'anthropic' | 'openai' | 'google' | 'moonshot' | string

export interface AiAgentModelConfig {
  model?: string
  api_format?: AiAgentModelApiFormat
  meta?: Record<string, unknown> | null
}

export interface UserModelInfo {
  text_model?: AiAgentModelConfig | null
  vlm_model?: AiAgentModelConfig | null
}

/**
 * 用户模型配置。内部走 @roxy/agent-api 的 UserApi。
 * getUserModel 支持传 headers（tracing headers 如 Conversation-Id/Turn-Id）和 AbortSignal。
 */
export const agentModelApi = {
  getUserModel(params: { headers?: Record<string, string>, signal?: AbortSignal } = {}): Promise<UserModelInfo> {
    return unwrap<UserModelInfo>(userApi.getUserModel({
      ...(params.headers ? { headers: params.headers } : {}),
      ...(params.signal ? { signal: params.signal } : {}),
    }))
  },
}

export type UserTaskPlanType = 'manual' | 'once' | 'cron'
export type UserTaskTemplateType = 'script' | 'skill' | 'prompt'

const USER_TASK_LIST_PLAN_TYPES: Readonly<Record<UserTaskPlanType, PlanTypeEnum>> = {
  manual: PlanTypeEnum.Manual,
  once: PlanTypeEnum.Once,
  cron: PlanTypeEnum.Cron,
}

export interface UserTaskDto {
  id: number
  workspaceId: string
  creatorUserId: string
  name: string
  userTemplateId: number
  windowIds: string[]
  metadata: Record<string, unknown>
  planType: UserTaskPlanType
  cron: string | null
  timezone: string | null
  executeAt: string | null
  nextExecuteAt: string | null
  enabled: boolean
  createdAt: string | null
  updatedAt: string | null
}

export interface UserTemplateDto {
  id: number
  workspaceId: string
  officialTemplateId: number | null
  templateType: UserTaskTemplateType
  name: string
  description: string | null
  source: 'custom' | 'official'
  metadata: Record<string, unknown>
  hasFile: boolean
  createdAt: string | null
  updatedAt: string | null
}

export interface UserTemplatePage {
  items: UserTemplateDto[]
  total: number
  limit: number
  offset: number
}

export interface UserTemplateListParams {
  limit?: number
  offset?: number
  templateType?: UserTaskTemplateType
}

export interface UserTaskPage {
  items: UserTaskDto[]
  total: number
  limit: number
  offset: number
}

export interface UserTaskListParams {
  limit?: number
  offset?: number
  planType?: UserTaskPlanType
}

function invalidAgentApiData(endpoint: string, payload: unknown): AiAgentHttpError {
  return new AiAgentHttpError(200, `AI Agent returned invalid data for ${endpoint}`, { payload })
}

function isUserTaskTemplateType(value: string): value is UserTaskTemplateType {
  return value === 'script' || value === 'skill' || value === 'prompt'
}

function isUserTemplateSource(value: string): value is UserTemplateDto['source'] {
  return value === 'custom' || value === 'official'
}

function normalizeUserTemplate(template: UserTemplateInfo, endpoint: string): UserTemplateDto {
  if (!isUserTaskTemplateType(template.templateType) || !isUserTemplateSource(template.source)) {
    throw invalidAgentApiData(endpoint, template)
  }

  return {
    ...template,
    templateType: template.templateType,
    source: template.source,
  }
}

export const agentUserTemplatesApi = {
  async list(params: UserTemplateListParams = {}): Promise<UserTemplatePage> {
    const page = await unwrap(userTemplatesApi.listUserTemplates({
      limit: params.limit,
      offset: params.offset,
      template_type: params.templateType,
    }))
    return {
      ...page,
      items: page.items.map(template => normalizeUserTemplate(template, 'GET /v1/user/templates')),
    }
  },
  async getById(templateId: string | number): Promise<UserTemplateDto> {
    const template = await unwrap(userTemplatesApi.getUserTemplate({ templateId: String(templateId) }))
    return normalizeUserTemplate(template, 'GET /v1/user/templates/{template_id}')
  },
  uploadSkill(file: File): Promise<TemplateSkillAssetInfo> {
    return unwrap<TemplateSkillAssetInfo>(userTemplatesApi.uploadUserTemplateSkill({ file }))
  },
  async create(input: UserTemplateCreate): Promise<UserTemplateDto> {
    const template = await unwrap(userTemplatesApi.createUserTemplate(input))
    return normalizeUserTemplate(template, 'POST /v1/user/templates')
  },
  async deleteById(templateId: number): Promise<void> {
    await unwrap(userTemplatesApi.deleteUserTemplate({ templateId }))
  },
}

export const agentUserTasksApi = {
  list(params: UserTaskListParams = {}): Promise<UserTaskPage> {
    return unwrap<UserTaskPage>(userTasksApi.listUserTasks({
      limit: params.limit,
      offset: params.offset,
      plan_type: params.planType ? USER_TASK_LIST_PLAN_TYPES[params.planType] : undefined,
    }))
  },
  getById(taskId: number): Promise<UserTaskDto> {
    return unwrap<UserTaskDto>(
      userTasksApi.getUserTask({ taskId }),
    )
  },
}
