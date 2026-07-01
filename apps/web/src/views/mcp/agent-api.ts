import { useAgentStore } from '/@/stores/agent'
import { useSimpleLocale } from '/@/stores/locale'
import { fetchSSE } from './utils/fetch'

// 对话类型定义
export interface Conversation {
  id: string
  title: string
  thread_id: string
  conversation_type?: 'automation' | 'asset'
  is_active?: number
  is_title_set?: number
  message_count?: number
  created_at: string
  updated_at: string
  model?: string
}

export interface ConversationDetail {
  id: string
  user_id: string
  workspace_id: string
  title: string
  thread_id: string
  conversation_type?: 'automation' | 'asset'
  model: null
  is_active: 0 | 1
  created_at: string
  updated_at: string
  messages: []
}

// 附件类型定义
export interface AttachmentRef {
  fileId: string
  fileName: string
  mimeType: string
  size?: number
  url?: string
  localUrl?: string
  remoteUrl?: string
  fileUrl?: string
}

export interface AssetGenerationRequest {
  message: string
  conversationId: string
  attachments?: AttachmentRef[]
  assetOptions: {
    aspectRatio: string
    quality: string
    count: string
  }
}

// MCP 服务器配置类型
export interface UserMcpServerConfig {
  type?: 'stdio' | 'http'
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
}

// Skill 相关类型
export type SkillSource = 'user' | 'store'

export interface SkillEntry {
  name: string
  title?: string | null
  description: string
  dirName: string
  installedAt: number
  hasScripts: boolean
  runtimeSource: 'declared' | 'inferred' | 'none'
  runtimes: SkillRuntime[]
  missingRuntimeIds: string[]
  /** 来源：用户自行导入 or 商城安装 */
  source: SkillSource
  /** 是否启用，禁用后不会被 agent 加载，但不会删除 */
  enabled: boolean
  /** 商城 skill 的 slug */
  slug?: string
}

export interface SkillRuntime {
  id: string
  displayName: string
  homepage: string
  installed: boolean
  version?: string
  source: 'declared' | 'inferred'
}

export type SkillValidationErrorCode
  = | 'path-not-found'
    | 'invalid-source-type'
    | 'zip-extract-failed'
    | 'missing-skill-md'
    | 'read-failed'
    | 'content-too-large'
    | 'missing-frontmatter'
    | 'invalid-yaml'
    | 'frontmatter-not-mapping'
    | 'missing-name'
    | 'missing-description'

export interface ValidateSkillSuccessData {
  name: string
  description: string
}

export interface ValidateSkillResponse {
  code: number
  msg?: string
  errorCode?: SkillValidationErrorCode
  data?: ValidateSkillSuccessData
}

export type UserModelType = 'text_model' | 'image_model' | 'vlm_model' | 'video_model'

export interface UserModelConfig {
  model?: string | null
  api_format?: string | null
}

export interface UserModelInfo {
  text_model?: UserModelConfig | null
  image_model?: UserModelConfig | null
  vlm_model?: UserModelConfig | null
  video_model?: UserModelConfig | null
}

export interface UserModelOption {
  model: string
  api_format: string
  alias?: string | null
  mate?: {
    title?: Record<string, string> | null
    desc?: Record<string, string> | null
  } | null
  meta?: {
    title?: Record<string, string> | null
    desc?: Record<string, string> | null
  } | null
}

export interface UserModelOptionsResult {
  model_type: UserModelType
  items: UserModelOption[]
}

export interface AgentApiResponse<T> {
  code: number
  data: T
  msg?: string
  message?: string
}

export type RecordingStatus = 'active' | 'processing' | 'done' | 'failed' | 'cancelled' | 'needs_review'
export type RecordingUIStatus = 'idle' | RecordingStatus
export type RecordingPhase = 'skeleton' | 'refine' | 'enhance' | 'done'

export interface RecordingStatusData {
  recordingId: string
  conversationId: string
  status: RecordingStatus
  phase?: RecordingPhase
  primaryDirId?: string
  eventCount: number
  createdAt: number
  stoppedAt?: number
  completedAt?: number
  finalScriptPath?: string
  finalScript?: string
  finalScriptFileId?: string
  finalScriptOssUrl?: string
  errorMessage?: string
}

// 手动运行脚本相关类型
export type ScriptRunStatus = 'running' | 'done' | 'failed' | 'killed' | 'timeout'

// 录制脚本（本地 agent）类型
export interface ScriptListItem {
  id: string
  name: string
  description?: string | null
  conversationId?: string | null
  dirId?: string | null
  source: string
  ossUrl?: string | null
  fileName?: string | null
  size?: number | null
  createdAt: string
  /** 是否可运行（后端有 oss_url 或 local_path 时为 true） */
  runnable?: boolean
}

export interface ScriptDetail extends ScriptListItem {
  content?: string
}

export interface ScriptRunStartResult {
  runId: string
  cdpUrl: string
}

export interface ScriptRunLogEvent {
  runId: string
  level?: string
  message: string
}

export interface ScriptRunDoneEvent {
  runId: string
  status: ScriptRunStatus
  exitCode: number | null
  artifacts?: Array<{ fileName: string, size: number, fileId?: string }>
}

export interface ScriptRunSubscribeCallbacks {
  onLog?: (evt: ScriptRunLogEvent) => void
  onDone?: (evt: ScriptRunDoneEvent) => void
  onError?: (err: unknown) => void
  signal?: AbortSignal
}

export function useAgentApi() {
  const agentStore = useAgentStore()
  const localeStore = useSimpleLocale()

  // 从 store 获取响应式状态
  const serverUrl = computed(() => agentStore.serverUrl)
  const health = computed(() => agentStore.health)

  // ============ 附件上传相关 API ============

  /**
   * 上传附件文件
   */
  async function uploadFile(data: string, mimeType: string, fileName: string) {
    const res = await fetch(`${serverUrl.value}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, mimeType, fileName }),
    })
    return await res.json()
  }

  /**
   * 获取附件文件
   */
  function getFileUrl(fileId: string, options: { download?: boolean, fileName?: string } = {}) {
    const params = new URLSearchParams()
    if (options.download)
      params.set('download', '1')
    if (options.fileName)
      params.set('filename', options.fileName)
    const query = params.toString()
    return `${serverUrl.value}/api/files/${fileId}${query ? `?${query}` : ''}`
  }

  // ============ 对话相关 API ============

  /**
   * 创建新对话
   */
  async function conversationCreate(conversationType?: 'automation' | 'asset') {
    const res = await fetch(`${serverUrl.value}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conversationType ? { conversationType } : {}),
    })
    return await res.json()
  }

  /**
   * 获取对话列表（active 排在前面）
   */
  async function conversationList() {
    const res = await fetch(`${serverUrl.value}/api/conversations`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    return await res.json()
  }

  /**
   * 获取对话详情
   */
  async function conversationDetail(id: string) {
    const res = await fetch(`${serverUrl.value}/api/conversations/${id}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    return await res.json()
  }

  /**
   * 更新对话信息
   */
  async function conversationUpdate(conversationId: string, data: { title?: string, model?: string, conversationType?: 'automation' | 'asset' }) {
    const res = await fetch(`${serverUrl.value}/api/conversations/${conversationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return await res.json()
  }

  /**
   * 删除对话
   */
  async function conversationDelete(id: string) {
    const res = await fetch(`${serverUrl.value}/api/conversations/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    })
    return await res.json()
  }

  /**
   * 读取文件内容
   */
  async function readFileContent(filePath: string) {
    const url = new URL(`${serverUrl.value}/api/conversations/readFileContent`)
    url.searchParams.set('filePath', filePath)
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    return await res.json()
  }

  // ============ 聊天相关 API ============

  /**
   * 开始对话（流式聊天）
   * 返回 Response 对象用于处理 SSE 流
   */
  function chat(params: {
    message: string
    conversationId: string
    enableThinking?: boolean
    mode?: 'orchestrator' | 'simple'
    attachments?: AttachmentRef[]
    multimodalAttachments?: boolean
  }) {
    return fetch(`${serverUrl.value}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
  }

  /**
   * 停止对话（包括 HITL 等待状态）
   */
  async function conversationStop(conversationId: string) {
    const res = await fetch(`${serverUrl.value}/api/conversations/${conversationId}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    return await res.json()
  }

  function generateImages(params: AssetGenerationRequest, signal?: AbortSignal) {
    return fetch(`${serverUrl.value}/api/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal,
    })
  }

  /**
   * 提交 HITL 审批决策
   */
  async function conversationResume(conversationId: string, decisions: Array<{ type: 'approve' | 'reject', reason?: string }>) {
    const res = await fetch(`${serverUrl.value}/api/conversations/${conversationId}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisions }),
    })
    return await res.json()
  }

  // ============ Model API ============

  async function getUserModel() {
    const res = await fetch(`${serverUrl.value}/api/model`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    return await (res.json() as Promise<AgentApiResponse<UserModelInfo>>)
  }

  async function listUserModelOptions(modelType: UserModelType) {
    const url = new URL(`${serverUrl.value}/api/model/options`)
    url.searchParams.set('model_type', modelType)
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    return await (res.json() as Promise<AgentApiResponse<UserModelOptionsResult>>)
  }

  async function switchUserModel(modelType: UserModelType, model: string | null, conversationId?: string) {
    const res = await fetch(`${serverUrl.value}/api/model`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_type: modelType,
        model,
        ...(conversationId ? { conversation_id: conversationId } : {}),
      }),
    })
    return await (res.json() as Promise<AgentApiResponse<UserModelInfo>>)
  }

  // ============ MCP 服务器管理 API ============

  /**
   * 获取所有用户自定义 MCP 列表
   */
  async function listMcpServers() {
    const res = await fetch(`${serverUrl.value}/api/mcp/servers`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    return await res.json()
  }

  /**
   * 新增/更新 MCP 配置（不自动启用）
   */
  async function upsertMcpServer(name: string, config: UserMcpServerConfig, oldName?: string) {
    const res = await fetch(`${serverUrl.value}/api/mcp/servers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, config, ...(oldName && oldName !== name ? { oldName } : {}) }),
    })
    return await res.json()
  }

  /**
   * 从 Claude Desktop JSON 格式批量导入
   */
  async function importMcpServers(mcpServers: Record<string, UserMcpServerConfig>) {
    const res = await fetch(`${serverUrl.value}/api/mcp/servers/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mcpServers }),
    })
    return await res.json()
  }

  /**
   * 删除 MCP 配置
   */
  async function deleteMcpServer(name: string) {
    const res = await fetch(`${serverUrl.value}/api/mcp/servers/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    })
    return await res.json()
  }

  /**
   * 启用 MCP 并测试连通性
   */
  async function enableMcpServer(name: string) {
    const res = await fetch(`${serverUrl.value}/api/mcp/servers/${encodeURIComponent(name)}/enable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    return await res.json()
  }

  /**
   * 禁用 MCP
   */
  async function disableMcpServer(name: string) {
    const res = await fetch(`${serverUrl.value}/api/mcp/servers/${encodeURIComponent(name)}/disable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    return await res.json()
  }

  /**
   * 测试 MCP 连通性（不改变 enabled 状态）
   */
  async function testMcpServer(name: string, config?: UserMcpServerConfig) {
    const res = await fetch(`${serverUrl.value}/api/mcp/servers/${encodeURIComponent(name)}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: config ? JSON.stringify({ config }) : undefined,
    })
    return await res.json()
  }

  // ============ Skill 管理 API ============

  /**
   * 获取已安装 skill 列表
   */
  async function listSkills() {
    const res = await fetch(`${serverUrl.value}/api/skills`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Language': localeStore.currentLocale || 'en',
      },
    })
    return await res.json()
  }

  /**
   * 校验路径是否符合 skill 规范
   */
  async function validateSkill(sourcePath: string) {
    const res = await fetch(`${serverUrl.value}/api/skills/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath }),
    })
    return await (res.json() as Promise<ValidateSkillResponse>)
  }

  /**
   * 从本地目录或 .zip 安装 skill
   */
  async function installSkill(sourcePath: string) {
    const res = await fetch(`${serverUrl.value}/api/skills/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath }),
    })
    return await res.json()
  }

  /**
   * 卸载 skill
   */
  async function uninstallSkill(name: string) {
    const res = await fetch(`${serverUrl.value}/api/skills/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    })
    return await res.json()
  }

  /**
   * 启用 skill（启用后可被 agent 加载）
   */
  async function enableSkill(name: string) {
    const res = await fetch(`${serverUrl.value}/api/skills/${encodeURIComponent(name)}/enable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    return await res.json()
  }

  /**
   * 禁用 skill（禁用后不会被 agent 加载，但不会删除）
   */
  async function disableSkill(name: string) {
    const res = await fetch(`${serverUrl.value}/api/skills/${encodeURIComponent(name)}/disable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    return await res.json()
  }

  // ============ Skills Store API ============

  async function storeListCategories() {
    const res = await fetch(`${serverUrl.value}/api/skills/store/categories`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    return await res.json()
  }

  async function storeListSkills(category?: string) {
    const url = new URL(`${serverUrl.value}/api/skills/store/skills`)
    if (category)
      url.searchParams.set('category', category)
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    return await res.json()
  }

  async function storeGetSkill(slug: string) {
    const res = await fetch(`${serverUrl.value}/api/skills/store/skills/${encodeURIComponent(slug)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    return await res.json()
  }

  async function storeListUserSkills() {
    const res = await fetch(`${serverUrl.value}/api/skills/store/user-skills`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    return await res.json()
  }

  async function storeInstallSkill(slug: string) {
    const res = await fetch(`${serverUrl.value}/api/skills/store/install/${encodeURIComponent(slug)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    return await res.json()
  }

  async function storeRemoveSkill(slug: string) {
    const res = await fetch(`${serverUrl.value}/api/skills/store/user-skills/${encodeURIComponent(slug)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    })
    return await res.json()
  }

  // ============ 录制相关 API ============

  /**
   * 启动录制
   */
  async function recordingStart(conversationId: string): Promise<AgentApiResponse<{
    recordingId: string
    conversationId: string
    status: string
    createdAt: number
  }>> {
    const res = await fetch(`${serverUrl.value}/api/recording/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    })
    return await res.json()
  }

  /**
   * 停止录制（触发后台处理）
   */
  async function recordingStop(conversationId: string): Promise<AgentApiResponse<{
    recordingId: string
    conversationId: string
    status: string
    eventCount: number
  }>> {
    const res = await fetch(`${serverUrl.value}/api/recording/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    })
    return await res.json()
  }

  /**
   * 查询录制状态
   */
  async function recordingStatus(conversationId: string): Promise<AgentApiResponse<RecordingStatusData | null>> {
    const res = await fetch(`${serverUrl.value}/api/recording/status/${encodeURIComponent(conversationId)}`)
    return await res.json()
  }

  /**
   * 取消脚本生成
   */
  async function recordingCancel(conversationId: string): Promise<AgentApiResponse<{
    recordingId: string
    conversationId: string
    status: string
  }>> {
    const res = await fetch(`${serverUrl.value}/api/recording/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    })
    return await res.json()
  }

  /**
   * 重试脚本生成（复用上次录制工作区，重新启动 enhance agent）
   */
  async function recordingRetry(conversationId: string): Promise<AgentApiResponse<{
    recordingId: string
    conversationId: string
    status: string
  }>> {
    const res = await fetch(`${serverUrl.value}/api/recording/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    })
    return await res.json()
  }

  // ============ 手动运行脚本相关 API ============

  /**
   * 查询当前被脚本运行占用的浏览器分身 dirId 列表
   */
  async function scriptRunOccupied(): Promise<AgentApiResponse<string[]>> {
    const res = await fetch(`${serverUrl.value}/api/scripts/run/occupied`)
    return await res.json()
  }

  /**
   * 启动一次手动脚本运行：后端会先打开浏览器分身，再以 sandbox 模式运行脚本
   */
  async function scriptRunStart(params: {
    scriptName: string
    scriptUrl: string
    dirId: string
  }): Promise<AgentApiResponse<ScriptRunStartResult>> {
    const res = await fetch(`${serverUrl.value}/api/scripts/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    return await res.json()
  }

  /**
   * 订阅脚本运行状态（SSE）：实时接收日志和完成事件
   */
  function scriptRunSubscribe(runId: string, callbacks: ScriptRunSubscribeCallbacks): void {
    void fetchSSE(`${serverUrl.value}/api/scripts/run/${encodeURIComponent(runId)}/status`, {
      method: 'GET',
      signal: callbacks.signal,
      onEvent: (evt) => {
        if (evt.event === 'log') {
          callbacks.onLog?.(evt.json as ScriptRunLogEvent)
        }
        else if (evt.event === 'done') {
          callbacks.onDone?.(evt.json as ScriptRunDoneEvent)
        }
      },
      onError: callbacks.onError,
    }).catch((err) => {
      callbacks.onError?.(err)
    })
  }

  /**
   * 中止运行中的脚本
   */
  async function scriptRunStop(runId: string): Promise<AgentApiResponse<null>> {
    const res = await fetch(`${serverUrl.value}/api/scripts/run/${encodeURIComponent(runId)}/stop`, {
      method: 'POST',
    })
    return await res.json()
  }

  // ============ 录制脚本 CRUD API ============

  /**
   * 获取本地录制脚本列表
   * @param opts.sync 为 true 时先由 agent 侧从后端拉取并合并本地，再返回本地列表
   */
  async function scriptList(opts?: { limit?: number, offset?: number, sync?: boolean }): Promise<AgentApiResponse<{ rows: ScriptListItem[], syncError?: string | null }>> {
    const url = new URL(`${serverUrl.value}/api/scripts`)
    if (opts?.limit != null)
      url.searchParams.set('limit', String(opts.limit))
    if (opts?.offset != null)
      url.searchParams.set('offset', String(opts.offset))
    if (opts?.sync)
      url.searchParams.set('sync', 'true')
    const res = await fetch(url.toString())
    return await res.json()
  }

  /**
   * 获取单个脚本详情
   */
  async function scriptDetail(id: string): Promise<AgentApiResponse<ScriptDetail>> {
    const res = await fetch(`${serverUrl.value}/api/scripts/${encodeURIComponent(id)}`)
    return await res.json()
  }

  /**
   * 重命名/改描述
   */
  async function scriptUpdate(id: string, patch: { name?: string, description?: string }): Promise<AgentApiResponse<ScriptListItem>> {
    const res = await fetch(`${serverUrl.value}/api/scripts/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    return await res.json()
  }

  /**
   * 删除脚本（仅删记录，不动 files/OSS）
   */
  async function scriptDelete(id: string): Promise<AgentApiResponse<null>> {
    const res = await fetch(`${serverUrl.value}/api/scripts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    return await res.json()
  }

  /**
   * 按 id 运行脚本（agent 从 DB 解析 file 路径），dirId 可选（缺省用脚本记录的 dirId）
   */
  async function scriptRunById(id: string, dirId?: string): Promise<AgentApiResponse<ScriptRunStartResult>> {
    const res = await fetch(`${serverUrl.value}/api/scripts/${encodeURIComponent(id)}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dirId ? { dirId } : {}),
    })
    return await res.json()
  }

  return {
    serverUrl,
    health,
    // 附件
    uploadFile,
    getFileUrl,
    // 对话
    conversationCreate,
    conversationList,
    conversationDetail,
    conversationUpdate,
    conversationDelete,
    readFileContent,
    // 聊天
    chat,
    generateImages,
    conversationStop,
    conversationResume,
    // Model
    getUserModel,
    listUserModelOptions,
    switchUserModel,
    // MCP
    listMcpServers,
    upsertMcpServer,
    importMcpServers,
    deleteMcpServer,
    enableMcpServer,
    disableMcpServer,
    testMcpServer,
    // Skill
    listSkills,
    validateSkill,
    installSkill,
    uninstallSkill,
    enableSkill,
    disableSkill,
    // Skills Store
    storeListCategories,
    storeListSkills,
    storeGetSkill,
    storeListUserSkills,
    storeInstallSkill,
    storeRemoveSkill,
    // Recording
    recordingStart,
    recordingStop,
    recordingStatus,
    recordingCancel,
    recordingRetry,
    // 手动运行脚本
    scriptRunOccupied,
    scriptRunStart,
    scriptRunSubscribe,
    scriptRunStop,
    // 录制脚本 CRUD
    scriptList,
    scriptDetail,
    scriptUpdate,
    scriptDelete,
    scriptRunById,
  }
}
