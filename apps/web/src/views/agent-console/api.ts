import { FeedbackApi, FilesApi, HttpClient, OfficialScriptsApi, TemplatesApi, UserTasksApi, UserTemplatesApi } from '@roxy/agent-api'
import type { ListOfficialTemplatesParams } from '@roxy/agent-api'
import type {
  AgentConversationRunEventDTO,
  AgentTaskLogStatus,
} from '@roxy/shared/channel'
import { API, createHttpClient } from '/@/api'
import { useAgentStore } from '/@/stores/agent'
import { useWorkspaceStore } from '/@/stores/workspace'
import {
  buildAgentBackendAuthorization,
  readAgentApiKey,
} from './agent-backend-auth'
import { createPerfTimer, perfLog } from '/@/utils/perf-log'
import { safeParseJSON } from '/@/utils'

type AgentConversationMessageCursor = string

export interface AgentConsoleConversationDTO {
  id: string
  title?: string
  model?: string
  status: 'active' | 'archived' | 'locked' | 'deleting'
  latestRunId?: string
  latestRunStatus?: 'streaming' | 'completed' | 'failed' | 'cancelled'
  unread: boolean
  createdAt: number
  updatedAt: number
}

export interface AgentConsoleConversationMessageDTO {
  id: string
  role: 'user' | 'assistant' | 'system'
  content?: string
  createdAt: number
  metadata?: {
    attachments?: AgentConsoleUploadResult[]
    [key: string]: unknown
  }
  events?: AgentConversationRunEventDTO[]
}

export interface AgentConsoleConversationArtifactDTO {
  id: string
  turnId: string
  fileName: string
  mimeType: string
  size: number
  operation: 'create' | 'update'
  createdAt: number
}

export interface AgentConsoleConversationDetailDTO {
  conversation: AgentConsoleConversationDTO
  messages: AgentConsoleConversationMessageDTO[]
  artifacts: AgentConsoleConversationArtifactDTO[]
  hasMore: boolean
  nextCursor: AgentConversationMessageCursor | null
}

export interface AgentConsoleCreateConversationRequest {
  title?: string
}

export interface AgentConsoleUploadResult {
  fileId: string
  fileName: string
  mimeType: string
  size: number
  url: string
  localUrl: string
  remoteUrl?: string
  fileUrl?: string
}

export interface AgentScriptSelfDescription {
  metadata: {
    name: string | Record<string, string>
    description?: string | string[] | Record<string, string | string[]>
    [key: string]: unknown
  }
  paramsSchema: Record<string, unknown>
}

export type { AgentTaskLogDTO, AgentTaskLogStatus } from '@roxy/shared/channel'

export interface AgentTaskRunStarted {
  logId: string
  status: AgentTaskLogStatus
}

export interface AgentTaskSyncResult {
  registeredCount: number
  syncedAt: string
}

export interface AgentTaskLogStopResult {
  stopping: boolean
}

export interface AgentTaskLogDeleteResult {
  deleted: boolean
}

interface AgentConsoleApiResponse<T> {
  code?: number
  data?: T
  msg?: string
  message?: string
}

export interface PresetTemplateInitialization {
  initialized: boolean
  createdCount: number
}

export interface ToppedTemplateResult {
  templateId: number
  isTopped: boolean
  toppedAt?: string | null
}

export interface AgentSkillPathInfo {
  installedRoot: string
  skillMdPath?: string
}

export interface AgentInstalledSkillDeleteResult {
  deleted: boolean
}

function getResponseMessage(value: AgentConsoleApiResponse<unknown>) {
  return value.msg || value.message || 'Agent request failed'
}

async function readAgentResponse<T>(response: Response): Promise<T> {
  const rawText = await response.text()
  let payload: AgentConsoleApiResponse<T> | T | undefined
  if (rawText) {
    try {
      payload = JSON.parse(rawText) as AgentConsoleApiResponse<T> | T
    }
    catch {
      // 响应体不是合法 JSON（如网关 5xx 返回的 HTML 或空 body）：
      // 不能让 JSON 解析错误掩盖真实 HTTP 状态。
      if (!response.ok) {
        throw new Error(`Agent request failed: ${response.status}`)
      }
      throw new Error('Agent response is not valid JSON')
    }
  }

  if (!response.ok) {
    const message = payload && typeof payload === 'object'
      ? getResponseMessage(payload as AgentConsoleApiResponse<unknown>)
      : `Agent request failed: ${response.status}`
    throw new Error(message)
  }

  if (payload && typeof payload === 'object' && 'code' in payload) {
    const wrapped = payload as AgentConsoleApiResponse<T>
    if (wrapped.code !== undefined && wrapped.code !== 0) {
      throw new Error(getResponseMessage(wrapped))
    }

    return wrapped.data as T
  }

  return payload as T
}

interface AgentBackendAuthContext {
  workspaceId: number
  apiKey: string
}

const AGENT_BACKEND_AUTH_CACHE_KEY = 'agent-console:backend-auth-cache'
const AGENT_BACKEND_AUTH_CACHE_TTL = 5 * 60 * 1000

interface AgentBackendAuthCache {
  workspaceId: number
  apiKey: string
  updatedAt: number
}

let agentBackendAuthPromise: Promise<AgentBackendAuthContext> | undefined

function readAgentBackendAuthCache(workspaceId?: number) {
  const cache = safeParseJSON(localStorage.getItem(AGENT_BACKEND_AUTH_CACHE_KEY), null) as AgentBackendAuthCache | null
  if (!cache?.workspaceId || !cache?.apiKey) {
    return null
  }
  if (workspaceId && cache.workspaceId !== workspaceId) {
    return null
  }
  if (Date.now() - cache.updatedAt > AGENT_BACKEND_AUTH_CACHE_TTL) {
    return null
  }
  return cache
}

function writeAgentBackendAuthCache(context: AgentBackendAuthContext) {
  localStorage.setItem(AGENT_BACKEND_AUTH_CACHE_KEY, JSON.stringify({
    workspaceId: context.workspaceId,
    apiKey: context.apiKey,
    updatedAt: Date.now(),
  } satisfies AgentBackendAuthCache))
}

export function clearAgentBackendAuthCache() {
  localStorage.removeItem(AGENT_BACKEND_AUTH_CACHE_KEY)
}

async function loadAgentBackendAuth(): Promise<AgentBackendAuthContext> {
  const endLoadAgentBackendAuth = createPerfTimer('agent-api:loadAgentBackendAuth')
  const workspaceStore = useWorkspaceStore()

  if (globalThis.isElectron) {
    perfLog('agent-api:loadAgentBackendAuth:getSoftConfig:start')
    const { workspaceId } = await globalThis.electronAPI.send('app:getSoftConfig')
    perfLog('agent-api:loadAgentBackendAuth:getSoftConfig:end', { workspaceId })
    if (workspaceId && workspaceId !== workspaceStore.currentWorkspace?.id) {
      await workspaceStore.prepareWorkspace(workspaceId)
    }
  }

  const workspaceId = workspaceStore.currentWorkspace?.id
  if (!workspaceId) {
    throw new Error($t('当前团队不可用'))
  }

  const cached = readAgentBackendAuthCache(workspaceId)
  if (cached) {
    endLoadAgentBackendAuth({
      workspaceId,
      cached: true,
    })
    perfLog('agent-api:loadAgentBackendAuth:cache:hit', { workspaceId })
    return {
      workspaceId,
      apiKey: cached.apiKey,
    }
  }

  const response = await API.base.userGetUserApiList()
  const apiKey = readAgentApiKey(response, $t('获取 API 密钥失败'))
  writeAgentBackendAuthCache({ workspaceId, apiKey })
  endLoadAgentBackendAuth({
    workspaceId,
  })
  return {
    workspaceId,
    apiKey,
  }
}

export function initializeAgentBackendAuth(): Promise<AgentBackendAuthContext> {
  if (!agentBackendAuthPromise) {
    const endInitializeAgentBackendAuth = createPerfTimer('agent-api:initializeAgentBackendAuth')
    agentBackendAuthPromise = loadAgentBackendAuth()
      .then((context) => {
        endInitializeAgentBackendAuth({ workspaceId: context.workspaceId })
        return context
      })
      .catch((error) => {
        endInitializeAgentBackendAuth({ error: error instanceof Error ? error.message : String(error) })
        agentBackendAuthPromise = undefined
        throw error
      })
  }

  return agentBackendAuthPromise
}

// The shared API helper is typed against the main backend client's generated
// HttpClient. The agent API client is generated separately, so its otherwise
// compatible client has a distinct private field and needs a local adapter.
const agentBackendHttpClient = createHttpClient(
  HttpClient as unknown as typeof import('@roxy/backend-api').HttpClient,
  async (config) => {
    const { apiKey } = await initializeAgentBackendAuth()
    config.headers.Authorization = buildAgentBackendAuthorization(
      apiKey,
      String(config.headers.token ?? ''),
    )
    config.baseURL = `${config.baseURL}/llm-proxy`
  },
) as unknown as HttpClient

/**
 * 官方模板列表接口的本地扩展：后端的置顶排序开关在下一次 OpenAPI 刷新后
 * 会进入生成客户端；在此之前仍由生成方法透传这个查询字段。
 */
type OfficialTemplateListQuery = ListOfficialTemplatesParams & {
  prioritizeTopped?: boolean
}

export function useAgentConsoleApi() {
  const agentStore = useAgentStore()
  const feedback = new FeedbackApi(agentBackendHttpClient)
  const files = new FilesApi(agentBackendHttpClient)
  const officialScripts = new OfficialScriptsApi(agentBackendHttpClient)
  const generatedTemplatesApi = new TemplatesApi(agentBackendHttpClient)
  const generatedListOfficialTemplates = generatedTemplatesApi.listOfficialTemplates.bind(generatedTemplatesApi)
  const templates = Object.assign(generatedTemplatesApi, {
    listOfficialTemplates: (
      query: OfficialTemplateListQuery,
      params?: Parameters<TemplatesApi['listOfficialTemplates']>[1],
    ) => generatedListOfficialTemplates(query, params),
    topOfficialTemplate: (templateId: number) => mutateTemplateTop(
      `/v1/templates/${templateId}/top`,
      'PUT',
    ),
    untopOfficialTemplate: (templateId: number) => mutateTemplateTop(
      `/v1/templates/${templateId}/top`,
      'DELETE',
    ),
  })
  const userTasks = new UserTasksApi(agentBackendHttpClient)
  const userTemplates = Object.assign(new UserTemplatesApi(agentBackendHttpClient), {
    topUserTemplate: (templateId: number) => mutateTemplateTop(
      `/v1/user/templates/${templateId}/top`,
      'PUT',
    ),
    untopUserTemplate: (templateId: number) => mutateTemplateTop(
      `/v1/user/templates/${templateId}/top`,
      'DELETE',
    ),
  })

  async function ensureAgentReady() {
    const endEnsureAgentReady = createPerfTimer('agent-api:ensureAgentReady')
    await agentStore.initMcp()

    if (!agentStore.serverUrl) {
      throw new Error('Agent server is not ready')
    }
    endEnsureAgentReady({ serverUrl: agentStore.serverUrl })
  }

  async function request<T>(path: string, init?: RequestInit) {
    const endRequest = createPerfTimer('agent-api:request', { path })
    await ensureAgentReady()
    const response = await fetch(`${agentStore.serverUrl}${path}`, {
      method: init?.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: init?.body,
      cache: 'no-store',
    })
    const result = await readAgentResponse<T>(response)
    endRequest({ path })
    return result
  }

  function createConversation(payload: AgentConsoleCreateConversationRequest = {}) {
    return request<AgentConsoleConversationDTO>('/api/conversations/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  function conversationList(options: { limit?: number, offset?: number } = {}) {
    const query = new URLSearchParams()
    if (options.limit !== undefined) {
      query.set('limit', String(options.limit))
    }
    if (options.offset !== undefined) {
      query.set('offset', String(options.offset))
    }

    const queryString = query.toString()
    return request<AgentConsoleConversationDTO[]>(`/api/conversations/list${queryString ? `?${queryString}` : ''}`)
  }

  function conversationDetail(
    conversationId: string,
    options: { cursor?: AgentConversationMessageCursor, limit?: number } = {},
  ) {
    const query = new URLSearchParams({ conversationId })
    if (options.cursor !== undefined) {
      query.set('cursor', options.cursor)
    }
    if (options.limit !== undefined) {
      query.set('limit', String(options.limit))
    }
    return request<AgentConsoleConversationDetailDTO>(`/api/conversations/detail?${query}`)
  }

  function updateConversation(conversationId: string, title: string) {
    return request<AgentConsoleConversationDTO>('/api/conversations/update', {
      method: 'POST',
      body: JSON.stringify({ conversationId, title }),
    })
  }

  function markConversationRead(conversationId: string, runId: string) {
    return request<AgentConsoleConversationDTO>('/api/conversations/mark-read', {
      method: 'POST',
      body: JSON.stringify({ conversationId, runId }),
    })
  }

  function deleteConversation(conversationId: string) {
    return request<{ deleted: true }>('/api/conversations/delete', {
      method: 'POST',
      body: JSON.stringify({ conversationId }),
    })
  }

  function scriptSelfDescription(code: string) {
    return request<AgentScriptSelfDescription>('/api/scripts/self-description', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  }

  function skillPathInfo(slug?: string) {
    const query = slug ? `?${new URLSearchParams({ slug })}` : ''
    return request<AgentSkillPathInfo>(`/api/skills/path-info${query}`)
  }

  function deleteInstalledSkill(slug: string) {
    return request<AgentInstalledSkillDeleteResult>(`/api/skills/installed/${encodeURIComponent(slug)}`, {
      method: 'DELETE',
    })
  }

  async function uploadFile(data: string, mimeType: string, fileName: string, conversationId?: string) {
    return request<AgentConsoleUploadResult>('/api/upload', {
      method: 'POST',
      body: JSON.stringify({ data, mimeType, fileName, ...(conversationId ? { conversationId } : {}) }),
    })
  }

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : ''
        const commaIndex = result.indexOf(',')
        resolve(commaIndex === -1 ? result : result.slice(commaIndex + 1))
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  function getFileUrl(fileId: string, options: { download?: boolean, fileName?: string } = {}) {
    const serverUrl = agentStore.serverUrl
    const params = new URLSearchParams()
    if (options.download) {
      params.set('download', '1')
    }
    if (options.fileName) {
      params.set('filename', options.fileName)
    }
    const query = params.toString()
    return `${serverUrl}/api/files/${encodeURIComponent(fileId)}${query ? `?${query}` : ''}`
  }

  function stopTaskLog(logId: string) {
    return request<AgentTaskLogStopResult>(`/api/tasks/logs/${encodeURIComponent(logId)}/stop`, {
      method: 'POST',
    })
  }

  function deleteTaskLog(logId: string) {
    return request<AgentTaskLogDeleteResult>(`/api/tasks/logs/${encodeURIComponent(logId)}`, {
      method: 'DELETE',
    })
  }

  function runTask(taskId: number) {
    return request<AgentTaskRunStarted>(`/api/tasks/${taskId}/run`, { method: 'POST' })
  }

  function syncTasks() {
    return request<AgentTaskSyncResult>('/api/tasks/sync', { method: 'POST' })
  }

  return {
    createConversation,
    deleteConversation,
    conversationDetail,
    conversationList,
    ensureAgentReady,
    feedback,
    files,
    initializeAgentBackendAuth,
    markConversationRead,
    officialScripts,
    fileToBase64,
    getFileUrl,
    scriptSelfDescription,
    deleteInstalledSkill,
    skillPathInfo,
    stopTaskLog,
    syncTasks,
    deleteTaskLog,
    runTask,
    templates,
    userTasks,
    userTemplates,
    uploadFile,
    updateConversation,
  }
}

async function mutateTemplateTop(path: string, method: 'PUT' | 'DELETE') {
  const response = await agentBackendHttpClient.request<AgentConsoleApiResponse<ToppedTemplateResult>>({
    path,
    method,
    format: 'json',
  })
  if (response.code !== undefined && response.code !== 0) {
    throw new Error(getResponseMessage(response))
  }
  if (!response.data) {
    throw new Error('Agent response is missing template top state')
  }

  return response.data
}
