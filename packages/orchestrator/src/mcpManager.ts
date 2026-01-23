import type { StructuredTool } from '@langchain/core/tools'
import type { Connection } from '@langchain/mcp-adapters'
// 这里管理外部的一些 mcp 服务，这些 mcp 服务将 roxybrowser 的能力提供出来，让 llm 能够理解用户的需求。
import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import path from 'node:path'
import { env } from './config'

function isElectron() {
  return 'type' in process
}

export class McpManager {
  private workerClients: Map<string, MultiServerMCPClient> = new Map()
  private workerTools: Map<string, StructuredTool[]> = new Map()
  count = 0

  command = isElectron() ? process.execPath : 'node'

  constructor() {
    console.log('command', this.command)
  }

  async createMcpClient(workerId: string) {
    const servers: Record<string, Connection> = {}
    const command = this.command

    // 创建 openapi 的 mcp 服务
    const openapi: Connection = {
      transport: 'stdio',
      command,
      args: [env.OPENAPI_SCRIPT_PATH!],
      env: {
        ...process.env,
        ROXY_API_KEY: env.ROXY_API_KEY!,
        ROXY_API_HOST: env.ROXY_API_HOST!,
        ELECTRON_RUN_AS_NODE: isElectron() ? '1' : '0',

      },
    }
    servers.roxybrowser_openapi = openapi

    // 创建 playwright 的 mcp 服务
    const playwright: Connection = {
      transport: 'stdio',
      command,
      args: [env.PLAYWRIGHT_SCRIPT_PATH!],
      env: {
        ...process.env,
        PLAYWRIGHT_MCP_SNAPSHOT_MODE: 'optimized',
        PLAYWRIGHT_MCP_ROXY_MODE: 'true',
        ELECTRON_RUN_AS_NODE: isElectron() ? '1' : '0',
        STATIC_FILE_PATH: path.join(env.CHECKPOINT_DIR!, 'static'),
      },
    }
    servers[`roxybrowser_playwright_${workerId}`] = playwright

    const client = new MultiServerMCPClient({
      mcpServers: servers,
    })
    await client.initializeConnections()
    const tools = await client.getTools()

    this.workerClients.set(workerId, client)
    this.workerTools.set(workerId, tools)
    this.count++
  }

  async destroyWorkerClient(workerId: string): Promise<void> {
    const client = this.workerClients.get(workerId)
    if (client) {
      try {
        await client.close()
      }
      catch (error: any) {
        console.warn(`[MCP] Error closing client for ${workerId}:`, error.message)
      }
      this.workerClients.delete(workerId)
      this.workerTools.delete(workerId)
      this.count--
    }
  }

  getToolsForWorker(workerId: string): StructuredTool[] {
    const tools = this.workerTools.get(workerId)
    if (!tools) {
      console.warn(`[MCP] No tools found for worker ${workerId}`)
      return []
    }
    return tools
  }

  async shutdown() {
    const workerIds = Array.from(this.workerClients.keys())
    await Promise.all(workerIds.map(id => this.destroyWorkerClient(id)))
    this.count = 0
  }
}

export const mcpManager = new McpManager()
