/**
 * Global MCP Clients
 *
 * 管理所有全局共享的 MCP 连接（无 worker 隔离）：
 * - OpenAPI MCP (in-memory transport)
 *
 * 新增全局 MCP 只需在 GLOBAL_MCP_REGISTRY 中添加条目。
 * 每个条目的工具列表全局只加载一次，后续调用直接返回缓存。
 */

import type { RuntimeMcpTool } from './runtimeMcpTool'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createRoxyBrowserMcpServer } from '@roxybrowser/openapi'
import { env } from '../../config'
import { createRuntimeMcpToolBundle } from './runtimeMcpTool'

interface GlobalMcpEntry {
  name: string
  getTools: () => Promise<RuntimeMcpTool[]>
  cache?: RuntimeMcpTool[]
}

async function createOpenApiTools(): Promise<RuntimeMcpTool[]> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const roxyServer = createRoxyBrowserMcpServer({
    roxy: {
      apiHost: env.ROXY_API_HOST,
      apiKey: env.ROXY_API_KEY,
    },
    context: {
      workspaceId: env.ROXY_WORKSPACE_ID ? Number(env.ROXY_WORKSPACE_ID) : undefined,
    },
    excludeTools: ['roxy_profile_open'],
  })
  await roxyServer.connect(serverTransport)
  const bundle = await createRuntimeMcpToolBundle('roxybrowser-openapi-mcp', clientTransport)
  return bundle.tools
}

const GLOBAL_MCP_REGISTRY: GlobalMcpEntry[] = [
  { name: 'openapi', getTools: createOpenApiTools },
]

async function loadEntry(entry: GlobalMcpEntry): Promise<RuntimeMcpTool[]> {
  if (entry.cache) {
    return entry.cache
  }
  const tools = await entry.getTools()
  entry.cache = tools
  return tools
}

/**
 * 获取所有已启用的全局 MCP 工具（当前只有 OpenAPI）
 * 供 chat 和 claw agent 使用。
 * 每个 MCP 全局只初始化一次；单个失败只打 warn，不影响其余工具加载
 */
export async function getGlobalMcpTools(_options: { includeFaq?: boolean } = {}): Promise<RuntimeMcpTool[]> {
  const entries = GLOBAL_MCP_REGISTRY
  const results = await Promise.allSettled(
    entries.map(entry => loadEntry(entry)),
  )
  const tools: RuntimeMcpTool[] = []
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled') {
      tools.push(...r.value)
    }
    else {
      console.warn(`[MCP] Global MCP "${entries[i].name}" failed to load:`, r.reason?.message)
    }
  }
  return tools
}

/**
 * 仅获取 OpenAPI 工具
 * 供脚本编写/调试流程使用
 */
export async function getOpenApiTools(): Promise<RuntimeMcpTool[]> {
  const entry = GLOBAL_MCP_REGISTRY.find(e => e.name === 'openapi')!
  return loadEntry(entry)
}
