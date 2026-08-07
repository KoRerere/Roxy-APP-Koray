import { useAgentStore } from '/@/stores/agent'

export interface UserMcpServerConfig {
  type?: 'stdio' | 'http'
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
}

export interface AgentSettingsApiResponse<T = unknown> {
  code: number
  data?: T
  msg?: string
  message?: string
}

export function useAgentSettingsApi() {
  const agentStore = useAgentStore()
  const serverUrl = computed(() => agentStore.serverUrl)

  async function ensureAgentReady() {
    await agentStore.initMcp()

    if (!serverUrl.value)
      throw new Error('Agent server is not ready')
  }

  async function request<T>(path: string, init?: RequestInit): Promise<AgentSettingsApiResponse<T>> {
    await ensureAgentReady()

    const res = await fetch(`${serverUrl.value}${path}`, {
      method: init?.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: init?.body,
      cache: 'no-store',
    })

    return await res.json()
  }

  function listMcpServers() {
    return request('/api/mcp/servers')
  }

  function upsertMcpServer(name: string, config: UserMcpServerConfig, oldName?: string) {
    return request('/api/mcp/servers', {
      method: 'POST',
      body: JSON.stringify({ name, config, ...(oldName && oldName !== name ? { oldName } : {}) }),
    })
  }

  function importMcpServers(mcpServers: Record<string, UserMcpServerConfig>) {
    return request('/api/mcp/servers/import', {
      method: 'POST',
      body: JSON.stringify({ mcpServers }),
    })
  }

  function deleteMcpServer(name: string) {
    return request(`/api/mcp/servers/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    })
  }

  function enableMcpServer(name: string) {
    return request(`/api/mcp/servers/${encodeURIComponent(name)}/enable`, {
      method: 'POST',
    })
  }

  function disableMcpServer(name: string) {
    return request(`/api/mcp/servers/${encodeURIComponent(name)}/disable`, {
      method: 'POST',
    })
  }

  function testMcpServer(name: string, config?: UserMcpServerConfig) {
    return request(`/api/mcp/servers/${encodeURIComponent(name)}/test`, {
      method: 'POST',
      body: config ? JSON.stringify({ config }) : undefined,
    })
  }

  return {
    deleteMcpServer,
    disableMcpServer,
    enableMcpServer,
    importMcpServers,
    listMcpServers,
    testMcpServer,
    upsertMcpServer,
  }
}
