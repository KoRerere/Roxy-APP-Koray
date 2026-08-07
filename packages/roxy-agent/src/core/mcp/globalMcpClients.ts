/**
 * Global MCP Clients
 *
 * 管理所有全局共享的 MCP 连接（无 worker 隔离）：
 * - OpenAPI MCP (in-memory transport)
 * - FAQ MCP (remote HTTP)
 *
 * 新增全局 MCP 只需在 GLOBAL_MCP_REGISTRY 中添加条目。
 * 每个条目的工具列表全局只加载一次，后续调用直接返回缓存。
 */

import type { DynamicStructuredTool, StructuredTool } from '@langchain/core/tools'
import { loadMcpTools, MultiServerMCPClient } from '@langchain/mcp-adapters'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createRoxyMcpServer } from '@roxybrowser/openapi'
import { env } from '../../config'

interface GlobalMcpEntry {
  name: string
  getTools: () => Promise<StructuredTool[]>
  cache?: StructuredTool[]
}

function getOpenApiServerOptions() {
  const workspaceId = Number(env.ROXY_WORKSPACE_ID)
  const context = Number.isFinite(workspaceId)
    ? { workspaceId }
    : undefined

  return {
    roxy: {
      apiHost: env.ROXY_API_HOST,
      apiKey: env.ROXY_API_KEY,
    },
    ...(context ? { context } : {}),
  }
}

async function createOpenApiTools(): Promise<DynamicStructuredTool[]> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const roxyServer = createRoxyMcpServer(getOpenApiServerOptions())
  await roxyServer.connect(serverTransport)
  const mcpClient = new Client(
    { name: 'roxybrowser-openapi-mcp', version: '1.0.0' },
    { capabilities: {} },
  )
  await mcpClient.connect(clientTransport)
  return loadMcpTools('roxybrowser', mcpClient as any)
}

async function createFaqTools(): Promise<StructuredTool[]> {
  const client = new MultiServerMCPClient({
    mcpServers: {
      'roxybrowser-faq': {
        transport: 'http',
        url: 'https://faq.roxybrowser.com/mcp',
      } as any,
    },
  })
  await client.initializeConnections()
  return client.getTools()
}

// 新增全局 MCP 只需在此添加条目
const GLOBAL_MCP_REGISTRY: GlobalMcpEntry[] = [
  { name: 'openapi', getTools: createOpenApiTools },
  { name: 'faq', getTools: createFaqTools },
]

async function loadEntry(entry: GlobalMcpEntry): Promise<StructuredTool[]> {
  if (entry.cache)
    return entry.cache
  const tools = await entry.getTools()
  entry.cache = tools
  return tools
}

/**
 * 获取所有全局 MCP 工具（OpenAPI + FAQ）
 * 供 chat 和 claw agent 使用
 * 每个 MCP 全局只初始化一次；单个失败只打 warn，不影响其余工具加载
 */
export async function getGlobalMcpTools(): Promise<StructuredTool[]> {
  const results = await Promise.allSettled(
    GLOBAL_MCP_REGISTRY.map(entry => loadEntry(entry)),
  )
  const tools: StructuredTool[] = []
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled') {
      tools.push(...r.value)
    }
    else {
      console.warn(`[MCP] Global MCP "${GLOBAL_MCP_REGISTRY[i].name}" failed to load:`, r.reason?.message)
    }
  }
  return tools
}

/**
 * 仅获取 OpenAPI 工具（不含 FAQ）
 * 供脚本编写/调试流程使用（RPA 场景不需要 FAQ）
 */
export async function getOpenApiTools(): Promise<StructuredTool[]> {
  const entry = GLOBAL_MCP_REGISTRY.find(e => e.name === 'openapi')!
  return loadEntry(entry)
}
