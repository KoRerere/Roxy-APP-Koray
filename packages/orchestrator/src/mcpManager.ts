// 这里管理外部的一些 mcp 服务，这些 mcp 服务将 roxybrowser 的能力提供出来，让 llm 能够理解用户的需求。

import type { StructuredTool } from '@langchain/core/tools'
import type { Connection } from '@langchain/mcp-adapters'
import { MultiServerMCPClient } from '@langchain/mcp-adapters'

export class McpManager {
  private workerClients: Map<string, MultiServerMCPClient> = new Map()
  private workerTools: Map<string, StructuredTool[]> = new Map()
  /**
   * 起始端口，多个 worker 的时候，它是自增的。
   */
  private basePort: number = 24567

  /**
   * 检查端口是否被占用。
   */
  private async isPortAvailable(port: number): Promise<boolean> {
    try {
      await fetch(`http://localhost:${port}/mcp`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(1000),
      })
      return false
    }
    catch (error) {
      return true
    }
  }

  async getPort() {
    let _port = this.basePort
    let available = await this.isPortAvailable(_port)
    while (!available) {
      _port += 1
      available = await this.isPortAvailable(_port)
    }
    this.basePort = _port + 1
    return this.basePort
  }

  async createMcpClient(workerId: string) {
    if (this.workerClients.size >= 8) {
      console.warn(`[MCP] Too many workers, cannot create more clients`)
      throw new Error(`[MCP] Too many workers, cannot create more clients. `)
    }

    const servers: Record<string, Connection> = {}

    // 创建 openapi 的 mcp 服务
    const openapi: Connection = {
      transport: 'stdio',
      command: 'node',
      args: [process.env.OPENAPI_SCRIPT_PATH!],
      env: {
        ...process.env,
        ROXY_API_KEY: process.env.ROXY_API_KEY!,
        ROXY_API_HOST: process.env.ROXY_API_HOST!,
      },
    }
    servers.roxybrowser_openapi = openapi

    // const port = await this.getPort()

    // 创建 playwright 的 mcp 服务
    const playwright: Connection = {
      transport: 'stdio',
      command: 'node',
      args: [process.env.PLAYWRIGHT_SCRIPT_PATH!],
      env: {
        ...process.env,
        PLAYWRIGHT_MCP_SNAPSHOT_MODE: 'optimized',
        PLAYWRIGHT_MCP_ROXY_MODE: 'true',
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
  }
}

export const mcpManager = new McpManager()
