/**
 * MCP Manager
 *
 * 三类 MCP 的生命周期：
 *
 * 1. openapi MCP  —— 走 InMemoryTransport，全局共享，无需额外进程
 * 2. playwright MCP —— 每个 worker 独立 stdio 子进程，随 worker 创建/销毁（浏览器上下文隔离）
 * 3. 用户自定义 MCP —— stdio / sse / http，全局共享连接，通过配置文件持久化，支持启用/禁用
 */

import type { DynamicStructuredTool, StructuredTool } from '@langchain/core/tools'
import type { Connection } from '@langchain/mcp-adapters'
import { loadMcpTools, MultiServerMCPClient } from '@langchain/mcp-adapters'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { RoxyBrowserMCPServer } from '@roxybrowser/openapi'
import { createHash } from 'node:crypto'
import { existsSync, readFile, readFileSync, writeFileSync } from 'node:fs'
import { readFile as readFileAsync } from 'node:fs/promises'
import path from 'node:path'
import { env } from './config'
import { wrapToolsWithErrorHandling } from './deepagents/tool-wrapper'

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

function isElectron() {
  return 'type' in process
}

/**
 * 将完整命令字符串解析为 [command, args[]]，支持引号包裹的带空格路径。
 * 例如: `node "/path/with spaces/server.js" --flag` → `["node", ["/path/with spaces/server.js", "--flag"]]`
 */
function parseCommandString(cmdStr: string): [string, string[]] {
  const tokens: string[] = []
  let current = ''
  let inQuote = false
  let quoteChar = ''

  for (const ch of cmdStr) {
    if (inQuote) {
      if (ch === quoteChar)
        inQuote = false
      else
        current += ch
    }
    else if (ch === '"' || ch === '\'') {
      inQuote = true
      quoteChar = ch
    }
    else if (ch === ' ' || ch === '\t') {
      if (current) {
        tokens.push(current)
        current = ''
      }
    }
    else {
      current += ch
    }
  }
  if (current)
    tokens.push(current)

  const [command = '', ...args] = tokens
  return [command, args]
}

async function calculateFileSha512Hex(filePath: string) {
  const fileBuffer = await readFileAsync(filePath)
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

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 用户自定义 MCP 服务配置（兼容 Claude Desktop 标准格式） */
export interface UserMcpServerConfig {
  /** stdio 传输：命令（含路径和可执行文件） */
  command?: string
  /** stdio 传输：参数 */
  args?: string[]
  /** stdio 传输：环境变量 */
  env?: Record<string, string>
  /** sse / streamable-http 传输：URL */
  url?: string
  /** sse / http 传输：HTTP 请求头 */
  headers?: Record<string, string>
  /** 传输类型，默认根据有无 command 自动判断 */
  type?: 'stdio' | 'sse' | 'http'
  /** 描述 */
  description?: string
}

export interface UserMcpEntry {
  name: string
  config: UserMcpServerConfig
  enabled: boolean
  createdAt: number
  /** 最后一次测试结果 */
  lastTestResult?: McpTestResult
}

export interface McpTestResult {
  success: boolean
  toolCount?: number
  toolNames?: string[]
  error?: string
  testedAt: number
}

/** Claude Desktop 标准配置文件结构 */
interface UserMcpServersFile {
  mcpServers: Record<string, UserMcpServerConfig>
}

/** 我们的扩展状态文件结构 */
interface UserMcpStateFile {
  servers: Record<string, {
    enabled: boolean
    createdAt?: number
    lastTestResult?: McpTestResult
  }>
}

// ─────────────────────────────────────────────
// Openapi MCP（in-memory，全局共享）
// ─────────────────────────────────────────────

/**
 * 创建 roxybrowser openapi MCP 工具列表（in-memory 协议，无子进程）
 */
export async function getRoxyLangChainTools(): Promise<DynamicStructuredTool[]> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const roxyServer = new RoxyBrowserMCPServer()
  await roxyServer.connect(serverTransport)
  const mcpClient = new Client(
    { name: 'roxybrowser-openapi-mcp', version: '1.0.0' },
    { capabilities: {} },
  )
  await mcpClient.connect(clientTransport)
  return loadMcpTools('roxybrowser', mcpClient as any)
}

// ─────────────────────────────────────────────
// McpManager
// ─────────────────────────────────────────────

export class McpManager {
  /** playwright per-worker 独立进程客户端 */
  private workerPlaywrightClients: Map<string, MultiServerMCPClient> = new Map()

  /** playwright per-worker 工具缓存 */
  private workerPlaywrightTools: Map<string, StructuredTool[]> = new Map()

  /** 用户自定义 MCP 共享连接（name → client） */
  private userMcpClients: Map<string, MultiServerMCPClient> = new Map()

  /** 用户自定义 MCP 工具缓存（name → tools） */
  private userMcpToolsCache: Map<string, StructuredTool[]> = new Map()

  /** 用户自定义 MCP 配置（内存中合并后的状态） */
  private userMcpEntries: Map<string, Omit<UserMcpEntry, 'name'>> = new Map()

  /** 规范配置文件路径（Claude Desktop 格式） */
  private readonly serversFilePath: string

  /** 扩展状态文件路径（我们自己的 enabled、lastTestResult 等） */
  private readonly stateFilePath: string

  /** electron 进程路径 */
  private readonly command = isElectron() ? process.execPath : 'node'

  /** 当前活跃 worker 数（仅计 playwright worker） */
  count = 0

  constructor() {
    this.serversFilePath = path.join(env.CHECKPOINT_DIR!, 'mcp_servers.json')
    this.stateFilePath = path.join(env.CHECKPOINT_DIR!, 'mcp_state.json')
    this._loadConfigFromDisk()
  }

  // ──────────────────────────────────────────
  // 配置持久化
  // ──────────────────────────────────────────

  private _loadConfigFromDisk() {
    try {
      // 加载规范配置 (mcpServers)
      let servers: Record<string, UserMcpServerConfig> = {}
      if (existsSync(this.serversFilePath)) {
        const raw = readFileSync(this.serversFilePath, 'utf-8')
        const file: UserMcpServersFile = JSON.parse(raw)
        servers = file.mcpServers || {}
      }

      // 加载扩展状态
      let state: Record<string, { enabled: boolean, lastTestResult?: McpTestResult }> = {}
      if (existsSync(this.stateFilePath)) {
        const raw = readFileSync(this.stateFilePath, 'utf-8')
        const file: UserMcpStateFile = JSON.parse(raw)
        state = file.servers || {}
      }

      // 合并到内存
      for (const [name, config] of Object.entries(servers)) {
        const s = state[name] || { enabled: false }
        this.userMcpEntries.set(name, {
          config,
          enabled: s.enabled,
          createdAt: s.createdAt ?? 0,
          lastTestResult: s.lastTestResult,
        })
      }

      console.log(`[MCP] Loaded ${this.userMcpEntries.size} user MCP configs from disk`)
      this._reconnectEnabledServers()
    }
    catch (err: any) {
      console.warn('[MCP] Failed to load user MCP configs:', err.message)
    }
  }

  private _reconnectEnabledServers() {
    for (const [name, entry] of this.userMcpEntries) {
      if (!entry.enabled)
        continue
      this._connectAndTest(name, entry.config, false).then((result) => {
        if (!result.success) {
          console.warn(`[MCP] Failed to reconnect user MCP "${name}" on startup:`, result.error)
          entry.enabled = false
          entry.lastTestResult = result
          this._saveConfigToDisk()
        }
        else {
          console.log(`[MCP] Reconnected user MCP "${name}" on startup (${result.toolCount} tools)`)
        }
      }).catch((err: any) => {
        console.warn(`[MCP] Unexpected error reconnecting "${name}":`, err.message)
      })
    }
  }

  private _saveConfigToDisk() {
    try {
      // 保存规范配置 (mcpServers)
      const servers: Record<string, UserMcpServerConfig> = {}
      // 保存扩展状态
      const state: Record<string, { enabled: boolean, lastTestResult?: McpTestResult }> = {}

      for (const [name, entry] of this.userMcpEntries) {
        servers[name] = entry.config
        state[name] = {
          enabled: entry.enabled,
          createdAt: entry.createdAt,
          lastTestResult: entry.lastTestResult,
        }
      }

      writeFileSync(this.serversFilePath, JSON.stringify({ mcpServers: servers }, null, 2), 'utf-8')
      writeFileSync(this.stateFilePath, JSON.stringify({ servers: state }, null, 2), 'utf-8')
    }
    catch (err: any) {
      console.warn('[MCP] Failed to save user MCP configs:', err.message)
    }
  }

  // ──────────────────────────────────────────
  // Playwright per-worker（进程隔离）
  // ──────────────────────────────────────────

  /**
   * 为指定 worker 创建专属 playwright MCP 子进程
   */
  async createPlaywrightClientForWorker(workerId: string): Promise<void> {
    await assertFileIntegritySha512(env.PLAYWRIGHT_SCRIPT_PATH!, env.PLAYWRIGHT_SCRIPT_SHA512, 'PLAYWRIGHT_SCRIPT_PATH')

    const playwright: Connection = {
      transport: 'stdio',
      command: this.command,
      args: [env.PLAYWRIGHT_SCRIPT_PATH!],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: isElectron() ? '1' : '0',
        ROXY_PLAYWRIGHT_OUTPUT_DIR: env.DOWNLOADS_DIR,
        PLAYWRIGHT_MCP_ALLOW_UNRESTRICTED_FILE_ACCESS: '1',
      },
    }

    const client = new MultiServerMCPClient({
      mcpServers: { [`roxybrowser_playwright_${workerId}`]: playwright },
    })
    await client.initializeConnections()
    const tools = await client.getTools()

    this.workerPlaywrightClients.set(workerId, client)
    this.workerPlaywrightTools.set(workerId, tools)
    this.count++
    console.log(`[MCP] Playwright client created for worker ${workerId}`)
  }

  /**
   * 销毁指定 worker 的 playwright MCP 子进程
   */
  async destroyPlaywrightClientForWorker(workerId: string): Promise<void> {
    const client = this.workerPlaywrightClients.get(workerId)
    if (!client)
      return
    try {
      await client.close()
    }
    catch (err: any) {
      console.warn(`[MCP] Error closing playwright client for ${workerId}:`, err.message)
    }
    this.workerPlaywrightClients.delete(workerId)
    this.workerPlaywrightTools.delete(workerId)
    this.count--
    console.log(`[MCP] Playwright client destroyed for worker ${workerId}`)
  }

  // ──────────────────────────────────────────
  // 工具聚合
  // ──────────────────────────────────────────

  /**
   * 获取指定 worker 的完整工具列表：
   *   openapi (in-memory) + playwright (per-worker) + 启用的用户自定义 MCP
   */
  async getToolsForWorker(workerId: string): Promise<StructuredTool[]> {
    const openapiTools = await getRoxyLangChainTools()
    const playwrightTools = this.workerPlaywrightTools.get(workerId) ?? []
    const userTools = this._getEnabledUserMcpTools()

    return wrapToolsWithErrorHandling(
      [...openapiTools, ...playwrightTools, ...userTools],
      { workerId, maxErrorsPerWorker: 10 },
    )
  }

  private _getEnabledUserMcpTools(): StructuredTool[] {
    const tools: StructuredTool[] = []
    for (const [name, entry] of this.userMcpEntries) {
      if (!entry.enabled)
        continue
      const cached = this.userMcpToolsCache.get(name)
      if (cached)
        tools.push(...cached)
    }
    return tools
  }

  // ──────────────────────────────────────────
  // 用户自定义 MCP 管理
  // ──────────────────────────────────────────

  /** 获取所有用户自定义 MCP 列表（含状态），按创建时间倒序 */
  listUserMcpServers(): UserMcpEntry[] {
    return Array.from(this.userMcpEntries.entries())
      .map(([name, entry]) => ({ name, ...entry }))
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  /** 新增或更新用户自定义 MCP 配置 */
  async upsertUserMcpServer(name: string, config: UserMcpServerConfig, enabled?: boolean): Promise<void> {
    const existing = this.userMcpEntries.get(name)
    if (existing?.enabled) {
      await this._disconnectUserMcp(name)
    }
    const shouldEnable = enabled ?? existing?.enabled ?? false
    this.userMcpEntries.set(name, {
      config,
      enabled: shouldEnable,
      createdAt: existing?.createdAt ?? Date.now(),
      lastTestResult: undefined,
    })
    this._saveConfigToDisk()

    if (shouldEnable) {
      const result = await this._connectAndTest(name, config, false)
      const entry = this.userMcpEntries.get(name)!
      if (!result.success) {
        entry.enabled = false
        console.warn(`[MCP] Failed to connect user MCP "${name}" on upsert:`, result.error)
      }
      else {
        console.log(`[MCP] Connected user MCP "${name}" on upsert (${result.toolCount} tools)`)
      }
      entry.lastTestResult = result
      this._saveConfigToDisk()
    }
  }

  /** 重命名用户自定义 MCP（迁移 enabled 状态，断开旧连接） */
  async renameUserMcpServer(oldName: string, newName: string, config: UserMcpServerConfig): Promise<void> {
    const existing = this.userMcpEntries.get(oldName)
    await this._disconnectUserMcp(oldName)
    this.userMcpEntries.delete(oldName)
    this.userMcpEntries.set(newName, {
      config,
      enabled: existing?.enabled ?? false,
      createdAt: existing?.createdAt ?? Date.now(),
      lastTestResult: undefined,
    })
    this._saveConfigToDisk()
  }

  /** 删除用户自定义 MCP */
  async removeUserMcpServer(name: string): Promise<void> {
    await this._disconnectUserMcp(name)
    this.userMcpEntries.delete(name)
    this._saveConfigToDisk()
  }

  /**
   * 启用用户自定义 MCP：
   * 尝试连接并获取工具列表，返回测试结果。
   * 连接成功才标记为 enabled。
   */
  async enableUserMcpServer(name: string): Promise<McpTestResult> {
    const entry = this.userMcpEntries.get(name)
    if (!entry)
      return { success: false, error: `MCP server "${name}" not found`, testedAt: Date.now() }

    // 先断开旧连接（如有）
    await this._disconnectUserMcp(name)

    const result = await this._connectAndTest(name, entry.config)
    entry.enabled = result.success
    entry.lastTestResult = result
    this._saveConfigToDisk()
    return result
  }

  /** 禁用用户自定义 MCP，断开连接 */
  async disableUserMcpServer(name: string): Promise<void> {
    const entry = this.userMcpEntries.get(name)
    if (!entry)
      return
    await this._disconnectUserMcp(name)
    entry.enabled = false
    this._saveConfigToDisk()
  }

  /**
   * 测试用户自定义 MCP 连通性（不改变 enabled 状态）
   */
  async testUserMcpServer(name: string): Promise<McpTestResult> {
    const entry = this.userMcpEntries.get(name)
    if (!entry)
      return { success: false, error: `MCP server "${name}" not found`, testedAt: Date.now() }

    const result = await this._connectAndTest(name, entry.config, true)
    entry.lastTestResult = result
    this._saveConfigToDisk()
    return result
  }

  /**
   * 测试给定的 MCP 配置（不保存，仅测试）
   */
  async testUserMcpServerConfig(name: string, config: UserMcpServerConfig): Promise<McpTestResult> {
    return await this._connectAndTest(name, config, true)
  }

  // ──────────────────────────────────────────
  // 私有辅助
  // ──────────────────────────────────────────

  private _buildConnection(name: string, config: UserMcpServerConfig): Connection {
    const hasCommand = !!config.command
    const type = config.type ?? (hasCommand ? 'stdio' : 'http')

    if (type === 'stdio') {
      if (!config.command)
        throw new Error(`[MCP] stdio transport requires "command" for server "${name}"`)
      const [cmd, parsedArgs] = parseCommandString(config.command)
      // 兼容旧格式（分离的 args 字段）和新格式（args 已合并入 command 字符串）
      const allArgs = [...parsedArgs, ...(config.args ?? [])]
      return {
        transport: 'stdio',
        command: cmd,
        args: allArgs,
        env: config.env ? { ...process.env, ...config.env } : process.env as any,
      } as Connection
    }

    if (type === 'http') {
      if (!config.url)
        throw new Error(`[MCP] http transport requires "url" for server "${name}"`)
      return {
        transport: 'http',
        url: config.url,
        ...(config.headers && Object.keys(config.headers).length > 0
          ? { headers: config.headers }
          : {}),
      } as unknown as Connection
    }

    throw new Error(`[MCP] Unknown transport type "${type}" for server "${name}"`)
  }

  /**
   * 连接并测试 MCP，若 dryRun=false 则缓存连接和工具。
   */
  private async _connectAndTest(name: string, config: UserMcpServerConfig, dryRun = false): Promise<McpTestResult> {
    let client: MultiServerMCPClient | undefined
    try {
      const connection = this._buildConnection(name, config)
      client = new MultiServerMCPClient({ mcpServers: { [name]: connection } })
      await client.initializeConnections()
      const tools = await client.getTools()

      if (dryRun) {
        // 测试完即关闭
        await client.close().catch(() => {})
      }
      else {
        // 成功则缓存
        this.userMcpClients.set(name, client)
        this.userMcpToolsCache.set(name, tools)
      }

      return {
        success: true,
        toolCount: tools.length,
        toolNames: tools.map(t => t.name),
        testedAt: Date.now(),
      }
    }
    catch (err: any) {
      if (dryRun && client) {
        await client.close().catch(() => {})
      }
      return {
        success: false,
        error: err.message,
        testedAt: Date.now(),
      }
    }
  }

  private async _disconnectUserMcp(name: string): Promise<void> {
    const client = this.userMcpClients.get(name)
    if (client) {
      await client.close().catch((err: any) => {
        console.warn(`[MCP] Error closing user MCP "${name}":`, err.message)
      })
      this.userMcpClients.delete(name)
      this.userMcpToolsCache.delete(name)
    }
  }

  // ──────────────────────────────────────────
  // 全局关闭
  // ──────────────────────────────────────────

  async shutdown() {
    // 关闭所有 playwright worker 客户端
    const workerIds = [...this.workerPlaywrightClients.keys()]
    await Promise.all(workerIds.map(id => this.destroyPlaywrightClientForWorker(id)))

    // 关闭所有用户自定义 MCP 连接
    const userNames = [...this.userMcpClients.keys()]
    await Promise.all(userNames.map(name => this._disconnectUserMcp(name)))

    this.count = 0
    console.log('[MCP] All connections closed')
  }
}

export const mcpManager = new McpManager()
