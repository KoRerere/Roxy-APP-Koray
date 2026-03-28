import type { StructuredTool } from '@langchain/core/tools'
import type { Connection } from '@langchain/mcp-adapters'
import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { env } from './config'
import { wrapToolsWithErrorHandling } from './deepagents/tool-wrapper'

function isElectron() {
  return 'type' in process
}

async function calculateFileSha512Hex(filePath: string) {
  const fileBuffer = await readFile(filePath)
  const hashSum = createHash('sha512')
  hashSum.update(fileBuffer)
  return hashSum.digest('hex')
}

async function assertFileIntegritySha512(filePath: string, expectedSha512: string | undefined, label: string) {
  if (!expectedSha512)
    return
  const localSha512 = await calculateFileSha512Hex(filePath)
  if (localSha512 !== expectedSha512.toLowerCase()) {
    throw new Error(`[MCP] ${label} sha512 mismatch`)
  }
}

export class McpManager {
  private workerClients: Map<string, MultiServerMCPClient> = new Map()
  private workerTools: Map<string, StructuredTool[]> = new Map()
  count = 0

  command = isElectron() ? process.execPath : 'node'

  async createMcpClient(workerId: string) {
    const servers: Record<string, Connection> = {}
    const command = this.command

    // 双重校验：防止被篡改的脚本被加载（通常来自主进程下载的落地文件）
    await assertFileIntegritySha512(env.OPENAPI_SCRIPT_PATH!, env.OPENAPI_SCRIPT_SHA512, 'OPENAPI_SCRIPT_PATH')
    await assertFileIntegritySha512(env.PLAYWRIGHT_SCRIPT_PATH!, env.PLAYWRIGHT_SCRIPT_SHA512, 'PLAYWRIGHT_SCRIPT_PATH')

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
        // PLAYWRIGHT_MCP_SNAPSHOT_MODE: 'optimized',
        // PLAYWRIGHT_MCP_ROXY_MODE: 'true',
        ELECTRON_RUN_AS_NODE: isElectron() ? '1' : '0',
        // STATIC_FILE_PATH: env.DOWNLOADS_DIR,
        // DEBUG: '*',
      },
    }
    servers[`roxybrowser_playwright_${workerId}`] = playwright

    const client = new MultiServerMCPClient({
      mcpServers: servers,
    })
    await client.initializeConnections()
    const tools = wrapToolsWithErrorHandling(await client.getTools(), {
      workerId,
      maxErrorsPerWorker: 10,
    })

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
    const workerIds = [...this.workerClients.keys()]
    await Promise.all(workerIds.map(id => this.destroyWorkerClient(id)))
    this.count = 0
  }

  async createOpenapiClient(workerId: string) {
    const command = this.command

    await assertFileIntegritySha512(env.OPENAPI_SCRIPT_PATH!, env.OPENAPI_SCRIPT_SHA512, 'OPENAPI_SCRIPT_PATH')

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
        BYTENODE_SCRIPT: env.OPENAPI_SCRIPT_PATH!,
      },
    }

    const client = new MultiServerMCPClient({
      mcpServers: {
        [workerId]: openapi,
      },
    })
    await client.initializeConnections()

    const tools = wrapToolsWithErrorHandling(await client.getTools(), {
      workerId,
      maxErrorsPerWorker: 10,
    })
    this.workerClients.set(workerId, client)
    this.workerTools.set(workerId, tools)
    return tools
  }

  async createPlaywrightClient(workerId: string) {
    const command = this.command

    await assertFileIntegritySha512(env.PLAYWRIGHT_SCRIPT_PATH!, env.PLAYWRIGHT_SCRIPT_SHA512, 'PLAYWRIGHT_SCRIPT_PATH')

    // 创建 playwright 的 mcp 服务
    const playwright: Connection = {
      transport: 'stdio',
      command,
      args: [env.PLAYWRIGHT_SCRIPT_PATH!],
      env: {
        ...process.env,
        // PLAYWRIGHT_MCP_SNAPSHOT_MODE: 'optimized',
        // PLAYWRIGHT_MCP_ROXY_MODE: 'true',
        ELECTRON_RUN_AS_NODE: isElectron() ? '1' : '0',
        PLAYWRIGHT_MCP_ALLOW_UNRESTRICTED_FILE_ACCESS: '1',
      },
    }

    const client = new MultiServerMCPClient({
      mcpServers: {
        [workerId]: playwright,
      },
    })
    await client.initializeConnections()

    const tools = wrapToolsWithErrorHandling(await client.getTools(), {
      workerId,
      maxErrorsPerWorker: 10,
    })
    this.workerClients.set(workerId, client)
    this.workerTools.set(workerId, tools)
    return tools
  }
}

export const mcpManager = new McpManager()
