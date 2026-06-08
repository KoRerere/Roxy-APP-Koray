import { useAgentStore } from '/@/stores/agent'
import { useSimpleLocale } from '/@/stores/locale'

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
  function getFileUrl(fileId: string) {
    return `${serverUrl.value}/api/files/${fileId}`
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

  async function switchUserModel(modelType: UserModelType, model: string | null) {
    const res = await fetch(`${serverUrl.value}/api/model`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_type: modelType, model }),
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
  }
}
