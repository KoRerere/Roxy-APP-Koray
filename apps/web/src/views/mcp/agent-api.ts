import { useAgentStore } from '/@/stores/agent'

// 对话类型定义
export interface Conversation {
  id: string
  title: string
  thread_id: string
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
export interface SkillEntry {
  name: string
  description: string
  dirName: string
  installedAt: number
}

export function useAgentApi() {
  const agentStore = useAgentStore()

  // 从 store 获取响应式状态
  const serverUrl = computed(() => agentStore.serverUrl)
  const health = computed(() => agentStore.health)

  // ============ 附件上传相关 API ============

  /**
   * 上传附件文件
   */
  function uploadFile(data: string, mimeType: string, fileName: string) {
    return fetch(`${serverUrl.value}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, mimeType, fileName }),
    }).then(res => res.json())
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
  function conversationCreate() {
    return fetch(`${serverUrl.value}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).then(res => res.json())
  }

  /**
   * 获取对话列表（active 排在前面）
   */
  function conversationList() {
    return fetch(`${serverUrl.value}/api/conversations`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }).then(res => res.json())
  }

  /**
   * 获取对话详情
   */
  function conversationDetail(id: string) {
    return fetch(`${serverUrl.value}/api/conversations/${id}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }).then(res => res.json())
  }

  /**
   * 更新对话信息
   */
  function conversationUpdate(conversationId: string, data: { title?: string, model?: string }) {
    return fetch(`${serverUrl.value}/api/conversations/${conversationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => res.json())
  }

  /**
   * 删除对话
   */
  function conversationDelete(id: string) {
    return fetch(`${serverUrl.value}/api/conversations/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    }).then(res => res.json())
  }

  /**
   * 读取文件内容
   */
  function readFileContent(filePath: string) {
    const url = new URL(`${serverUrl.value}/api/conversations/readFileContent`)
    url.searchParams.set('filePath', filePath)
    return fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }).then(res => res.json())
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
   * 中断对话
   */
  function conversationInterrupt(conversationId: string) {
    return fetch(`${serverUrl.value}/api/chat/${conversationId}/interrupt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).then(res => res.json())
  }

  /**
   * 提交 HITL 审批决策
   */
  function conversationResume(conversationId: string, decisions: Array<{ type: 'approve' | 'reject', reason?: string }>) {
    return fetch(`${serverUrl.value}/api/chat/${conversationId}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisions }),
    }).then(res => res.json())
  }

  // ============ MCP 服务器管理 API ============

  /**
   * 获取所有用户自定义 MCP 列表
   */
  function listMcpServers() {
    return fetch(`${serverUrl.value}/api/mcp/servers`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }).then(res => res.json())
  }

  /**
   * 新增/更新 MCP 配置（不自动启用）
   */
  function upsertMcpServer(name: string, config: UserMcpServerConfig, oldName?: string) {
    return fetch(`${serverUrl.value}/api/mcp/servers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, config, ...(oldName && oldName !== name ? { oldName } : {}) }),
    }).then(res => res.json())
  }

  /**
   * 从 Claude Desktop JSON 格式批量导入
   */
  function importMcpServers(mcpServers: Record<string, UserMcpServerConfig>) {
    return fetch(`${serverUrl.value}/api/mcp/servers/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mcpServers }),
    }).then(res => res.json())
  }

  /**
   * 删除 MCP 配置
   */
  function deleteMcpServer(name: string) {
    return fetch(`${serverUrl.value}/api/mcp/servers/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    }).then(res => res.json())
  }

  /**
   * 启用 MCP 并测试连通性
   */
  function enableMcpServer(name: string) {
    return fetch(`${serverUrl.value}/api/mcp/servers/${encodeURIComponent(name)}/enable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).then(res => res.json())
  }

  /**
   * 禁用 MCP
   */
  function disableMcpServer(name: string) {
    return fetch(`${serverUrl.value}/api/mcp/servers/${encodeURIComponent(name)}/disable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).then(res => res.json())
  }

  /**
   * 测试 MCP 连通性（不改变 enabled 状态）
   */
  function testMcpServer(name: string, config?: UserMcpServerConfig) {
    return fetch(`${serverUrl.value}/api/mcp/servers/${encodeURIComponent(name)}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: config ? JSON.stringify({ config }) : undefined,
    }).then(res => res.json())
  }

  // ============ Skill 管理 API ============

  /**
   * 获取已安装 skill 列表
   */
  function listSkills() {
    return fetch(`${serverUrl.value}/api/skills`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }).then(res => res.json())
  }

  /**
   * 校验路径是否符合 skill 规范
   */
  function validateSkill(sourcePath: string) {
    return fetch(`${serverUrl.value}/api/skills/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath }),
    }).then(res => res.json())
  }

  /**
   * 从本地目录或 .zip 安装 skill
   */
  function installSkill(sourcePath: string) {
    return fetch(`${serverUrl.value}/api/skills/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath }),
    }).then(res => res.json())
  }

  /**
   * 卸载 skill
   */
  function uninstallSkill(name: string) {
    return fetch(`${serverUrl.value}/api/skills/${name}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    }).then(res => res.json())
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
    conversationInterrupt,
    conversationResume,
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
  }
}
