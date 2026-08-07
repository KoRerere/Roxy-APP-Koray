/**
 * MCP Manager
 *
 * 三类 MCP 的生命周期：
 *
 * 1. 全局 MCP（openapi / faq）—— 见 globalMcpClients.ts，全局共享，无需进程隔离
 * 2. playwright MCP —— 每个 worker 独立 in-memory 客户端，随 worker 创建/销毁（浏览器上下文隔离）
 * 3. 用户自定义 MCP —— stdio / http，全局共享连接，通过配置文件持久化，支持启用/禁用
 */

import type { StructuredTool } from '@langchain/core/tools'
import type { Connection } from '@langchain/mcp-adapters'
import type { CreateRoxyBrowserMcpServerOptions, RoxyBrowserLaunchConfig } from '@roxybrowser/playwright/mcp'
import { loadMcpTools, MultiServerMCPClient } from '@langchain/mcp-adapters'
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js'
import { createRoxyBrowserMcpInMemory } from '@roxybrowser/playwright/mcp'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { env } from '@/config'
import { agentPaths } from '@/core/storage/agentPaths'
import { getGlobalMcpTools } from './globalMcpClients'
import { withWindowScopeGuard } from './windowScope'

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

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

interface CloseableMcpClient {
  close: () => Promise<void>
}

interface PlaywrightMcpClientBundle {
  client: CloseableMcpClient
  tools: StructuredTool[]
}

const HIDDEN_BUILTIN_TOOL_NAMES = new Set([
  // OpenAPI MCP 里的低层开窗工具只保留内部能力；模型统一使用
  // Playwright MCP 的 roxy_browser_launch（开窗 + 连接）。
  'roxy_open_browsers',
  'roxy_browser_open',
  'roxy_browser_connect',
])

function filterHiddenBuiltinTools(tools: StructuredTool[]): StructuredTool[] {
  return tools.filter(tool => !HIDDEN_BUILTIN_TOOL_NAMES.has(tool.name))
}

function createRoxyBrowserLaunchConfig(): RoxyBrowserLaunchConfig | undefined {
  const workspaceId = Number(env.ROXY_WORKSPACE_ID)
  if (!Number.isFinite(workspaceId) || !env.ROXY_API_KEY || !env.ROXY_API_HOST) {
    console.warn('[MCP] roxy_browser_launch disabled: missing ROXY_WORKSPACE_ID, ROXY_API_KEY, or ROXY_API_HOST')
    return undefined
  }

  try {
    const apiUrl = new URL(env.ROXY_API_HOST)
    return {
      workspaceId,
      apiToken: env.ROXY_API_KEY,
      host: apiUrl.hostname,
      apiPort: apiUrl.port || (apiUrl.protocol === 'https:' ? 443 : 80),
    }
  }
  catch (err: any) {
    console.warn('[MCP] roxy_browser_launch disabled: invalid ROXY_API_HOST:', err.message)
    return undefined
  }
}

async function createInProcessPlaywrightMcpClient(
  serverName: string,
  options: CreateRoxyBrowserMcpServerOptions,
): Promise<PlaywrightMcpClientBundle> {
  const inMemoryBundle = await createRoxyBrowserMcpInMemory(options)
  const client = new McpClient({ name: serverName, version: '1.0.0' })

  try {
    await client.connect(inMemoryBundle.clientTransport)
    const tools = await loadMcpTools(serverName, client as any)
    return {
      client: {
        close: async () => {
          await client.close()
          await inMemoryBundle.close()
        },
      },
      tools,
    }
  }
  catch (err) {
    await client.close().catch(() => {})
    await inMemoryBundle.close().catch(() => {})
    throw err
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
  /** streamable-http 传输：URL */
  url?: string
  /** http 传输：HTTP 请求头 */
  headers?: Record<string, string>
  /** 传输类型，默认根据有无 command 自动判断 */
  type?: 'stdio' | 'http'
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
  /** 内置 MCP，不可修改/删除 */
  builtin?: boolean
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
// McpManager
// ─────────────────────────────────────────────

export class McpManager {
  /** playwright per-worker 独立 MCP 客户端 */
  private workerPlaywrightClients: Map<string, CloseableMcpClient> = new Map()

  /** playwright per-worker 工具缓存 */
  private workerPlaywrightTools: Map<string, StructuredTool[]> = new Map()

  /** per-worker 授权窗口 dirId 集合（未设置表示不限制） */
  private workerAllowedDirIds: Map<string, Set<string>> = new Map()

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

  /** 当前活跃 worker 数（仅计 playwright worker） */
  count = 0

  constructor() {
    // MCP 配置迁移到 state/mcp/ 下。state.json 与 servers.json 的合并（见设计文档 §4）留待后续，
    // 本阶段仅做路径归位，保持双文件结构不变。
    this.serversFilePath = agentPaths.mcpServersFile
    this.stateFilePath = path.join(path.dirname(agentPaths.mcpServersFile), 'state.json')
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
      let state: Record<string, { enabled: boolean, createdAt?: number, lastTestResult?: McpTestResult }> = {}
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
      const state: Record<string, { enabled: boolean, createdAt?: number, lastTestResult?: McpTestResult }> = {}

      for (const [name, entry] of this.userMcpEntries) {
        servers[name] = entry.config
        state[name] = {
          enabled: entry.enabled,
          createdAt: entry.createdAt,
          lastTestResult: entry.lastTestResult,
        }
      }

      mkdirSync(path.dirname(this.serversFilePath), { recursive: true })
      writeFileSync(this.serversFilePath, JSON.stringify({ mcpServers: servers }, null, 2), 'utf-8')
      writeFileSync(this.stateFilePath, JSON.stringify({ servers: state }, null, 2), 'utf-8')
    }
    catch (err: any) {
      console.warn('[MCP] Failed to save user MCP configs:', err.message)
    }
  }

  // ──────────────────────────────────────────
  // Playwright per-worker（同进程 in-memory）
  // ──────────────────────────────────────────

  /**
   * 检测 Playwright MCP 是否就绪（内置入口可用）。
   *
   * 用于启动 run_script debug 测试前的环境准备：
   * 确认底层浏览器 MCP 可被拉起，避免增强流程跑到测试环节才失败。
   */
  async checkPlaywrightMcpReadiness(): Promise<{ ready: boolean, reason?: string }> {
    return typeof createRoxyBrowserMcpInMemory === 'function'
      ? { ready: true }
      : { ready: false, reason: '@roxybrowser/playwright/mcp createRoxyBrowserMcpInMemory 不可用' }
  }

  /**
   * 为指定 worker 创建专属 playwright MCP 客户端
   */
  async createPlaywrightClientForWorker(workerId: string, sessionId: string): Promise<void> {
    const serverName = `roxybrowser_playwright_${workerId}`

    const artifactsDir = agentPaths.sessionBrowserDir(sessionId)
    const downloadsDir = agentPaths.sessionBrowserDownloadsDir(sessionId)
    const screenshotsDir = agentPaths.sessionBrowserScreenshotsDir(sessionId)
    const snapshotsDir = agentPaths.sessionBrowserSnapshotsDir(sessionId)
    const tracesDir = agentPaths.sessionBrowserTracesDir(sessionId)
    const tempDir = snapshotsDir

    for (const dir of [artifactsDir, downloadsDir, screenshotsDir, snapshotsDir, tracesDir, tempDir])
      mkdirSync(dir, { recursive: true })

    const { client, tools } = await createInProcessPlaywrightMcpClient(serverName, {
      artifactsDir,
      downloadsDir,
      screenshotsDir,
      snapshotsDir,
      tracesDir,
      videosDir: tracesDir,
      tempDir,
      serverInfo: {
        name: serverName,
        version: '1.0.0',
      },
      roxyBrowserLaunch: createRoxyBrowserLaunchConfig(),
    })

    this.workerPlaywrightClients.set(workerId, client)
    this.workerPlaywrightTools.set(workerId, tools)
    this.count++
    console.log(`[MCP] Playwright client created for worker ${workerId}`)
  }

  /**
   * 销毁指定 worker 的 playwright MCP 客户端
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
    this.workerAllowedDirIds.delete(workerId)
    this.count--
    console.log(`[MCP] Playwright client destroyed for worker ${workerId}`)
  }

  // ──────────────────────────────────────────
  // 工具聚合
  // ──────────────────────────────────────────

  /**
   * 获取指定 worker 的完整工具列表：
   *   openapi (in-memory) + playwright (per-worker) + 启用的用户自定义 MCP
   *
   * @param workerId worker 标识
   * @param needPlaywright 是否包含 Playwright MCP 工具
   */
  async getToolsForWorker(workerId: string, needPlaywright = true): Promise<StructuredTool[]> {
    const globalTools = await getGlobalMcpTools()
    const playwrightTools = needPlaywright ? this.workerPlaywrightTools.get(workerId) ?? [] : []
    const userTools = this._getEnabledUserMcpTools()

    // Keep low-level browser open/connect tools internal. The agent should use
    // roxy_browser_launch, which opens a window and attaches Playwright in one step.
    const visible = filterHiddenBuiltinTools([...globalTools, ...playwrightTools, ...userTools])
    // 窗口作用域在工具调用层强制，而不是只靠提示词约束。
    return visible.map(tool => withWindowScopeGuard(tool, () => this.workerAllowedDirIds.get(workerId)))
  }

  /**
   * 声明某个 worker 只允许操作这些窗口。传空数组等于清除限制。
   */
  setWorkerAllowedDirIds(workerId: string, dirIds: string[]): void {
    if (dirIds.length === 0) {
      this.workerAllowedDirIds.delete(workerId)
      return
    }
    this.workerAllowedDirIds.set(workerId, new Set(dirIds))
  }

  getWorkerAllowedDirIds(workerId: string): string[] {
    return Array.from(this.workerAllowedDirIds.get(workerId) ?? [])
  }

  clearWorkerAllowedDirIds(workerId: string): void {
    this.workerAllowedDirIds.delete(workerId)
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
      const originalToolNames = tools.map(t => t.name)

      if (dryRun) {
        // 测试完即关闭
        await client.close().catch(() => {})
      }
      else {
        // 缓存前加 {serverName}: 前缀，防止与内置工具名冲突
        for (const tool of tools) {
          tool.name = `${name}__${tool.name}`
        }
        this.userMcpClients.set(name, client)
        this.userMcpToolsCache.set(name, tools)
      }

      return {
        success: true,
        toolCount: tools.length,
        toolNames: originalToolNames,
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
