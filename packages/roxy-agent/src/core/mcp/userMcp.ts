import type { RuntimeMcpTool } from './runtimeMcpTool'
import type { McpServerConfig } from 'roxy-agent-runtime'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { McpClient } from 'roxy-agent-runtime'
import { createRuntimeMcpTools } from './runtimeMcpTool'

/** 用户自定义 MCP 服务配置（兼容 Claude Desktop 标准格式）。 */
export interface UserMcpServerConfig {
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
  type?: 'stdio' | 'http'
  description?: string
}

export interface UserMcpEntry {
  name: string
  config: UserMcpServerConfig
  enabled: boolean
  createdAt: number
  lastTestResult?: McpTestResult
  builtin?: boolean
}

export interface McpTestResult {
  success: boolean
  toolCount?: number
  toolNames?: string[]
  error?: string
  testedAt: number
}

interface UserMcpServersFile {
  mcpServers: Record<string, UserMcpServerConfig>
}

interface UserMcpStateFile {
  servers: Record<string, {
    enabled: boolean
    createdAt?: number
    lastTestResult?: McpTestResult
  }>
}

function parseCommandString(cmdStr: string): [string, string[]] {
  const tokens: string[] = []
  let current = ''
  let inQuote = false
  let quoteChar = ''

  for (const ch of cmdStr) {
    if (inQuote) {
      if (ch === quoteChar) {
        inQuote = false
      }
      else {
        current += ch
      }
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
  if (current) {
    tokens.push(current)
  }

  const [command = '', ...args] = tokens
  return [command, args]
}

export interface UserMcpManagerOptions {
  serversFilePath: string
  stateFilePath: string
}

/** Owns user-configured MCP persistence and shared connections. */
export class UserMcpManager {
  private readonly clients = new Map<string, McpClient>()
  private readonly toolsCache = new Map<string, RuntimeMcpTool[]>()
  private readonly entries = new Map<string, Omit<UserMcpEntry, 'name'>>()

  constructor(private readonly options: UserMcpManagerOptions) {
    this.loadConfigFromDisk()
  }

  getEnabledTools(): RuntimeMcpTool[] {
    const tools: RuntimeMcpTool[] = []
    for (const [name, entry] of this.entries) {
      if (!entry.enabled) {
        continue
      }
      const cached = this.toolsCache.get(name)
      if (cached) {
        tools.push(...cached)
      }
    }
    return tools
  }

  listServers(): UserMcpEntry[] {
    return Array.from(this.entries.entries())
      .map(([name, entry]) => ({ name, ...entry }))
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  async upsertServer(name: string, config: UserMcpServerConfig, enabled?: boolean): Promise<void> {
    const existing = this.entries.get(name)
    if (existing?.enabled) {
      await this.disconnect(name)
    }

    const shouldEnable = enabled ?? existing?.enabled ?? false
    this.entries.set(name, {
      config,
      enabled: shouldEnable,
      createdAt: existing?.createdAt ?? Date.now(),
      lastTestResult: undefined,
    })
    this.saveConfigToDisk()

    if (shouldEnable) {
      const result = await this.connectAndTest(name, config)
      const entry = this.entries.get(name)!
      if (!result.success) {
        entry.enabled = false
        console.warn(`[MCP] Failed to connect user MCP "${name}" on upsert:`, result.error)
      }
      else {
        console.log(`[MCP] Connected user MCP "${name}" on upsert (${result.toolCount} tools)`)
      }
      entry.lastTestResult = result
      this.saveConfigToDisk()
    }
  }

  async renameServer(oldName: string, newName: string, config: UserMcpServerConfig): Promise<void> {
    const existing = this.entries.get(oldName)
    await this.disconnect(oldName)
    this.entries.delete(oldName)
    this.entries.set(newName, {
      config,
      enabled: existing?.enabled ?? false,
      createdAt: existing?.createdAt ?? Date.now(),
      lastTestResult: undefined,
    })
    this.saveConfigToDisk()
  }

  async removeServer(name: string): Promise<void> {
    await this.disconnect(name)
    this.entries.delete(name)
    this.saveConfigToDisk()
  }

  async enableServer(name: string): Promise<McpTestResult> {
    const entry = this.entries.get(name)
    if (!entry) {
      return this.notFound(name)
    }

    await this.disconnect(name)
    const result = await this.connectAndTest(name, entry.config)
    entry.enabled = result.success
    entry.lastTestResult = result
    this.saveConfigToDisk()
    return result
  }

  async disableServer(name: string): Promise<void> {
    const entry = this.entries.get(name)
    if (!entry) {
      return
    }
    await this.disconnect(name)
    entry.enabled = false
    this.saveConfigToDisk()
  }

  async testServer(name: string): Promise<McpTestResult> {
    const entry = this.entries.get(name)
    if (!entry) {
      return this.notFound(name)
    }

    const result = await this.connectAndTest(name, entry.config, true)
    entry.lastTestResult = result
    this.saveConfigToDisk()
    return result
  }

  testConfig(name: string, config: UserMcpServerConfig): Promise<McpTestResult> {
    return this.connectAndTest(name, config, true)
  }

  /** Exposed for the route-independent transport unit test. */
  buildConnection(name: string, config: UserMcpServerConfig): McpServerConfig {
    const hasCommand = !!config.command
    const type = config.type ?? (hasCommand ? 'stdio' : 'http')

    if (type === 'stdio') {
      if (!config.command) {
        throw new Error(`[MCP] stdio transport requires "command" for server "${name}"`)
      }
      const [cmd, parsedArgs] = parseCommandString(config.command)
      return {
        name,
        transport: 'stdio',
        command: cmd,
        args: [...parsedArgs, ...(config.args ?? [])],
        env: config.env ? { ...process.env, ...config.env } : process.env as any,
      }
    }

    if (type === 'http') {
      if (!config.url) {
        throw new Error(`[MCP] http transport requires "url" for server "${name}"`)
      }
      return {
        name,
        transport: 'http',
        url: config.url,
        ...(config.headers && Object.keys(config.headers).length > 0 ? { headers: config.headers } : {}),
      }
    }

    throw new Error(`[MCP] Unknown transport type "${type}" for server "${name}"`)
  }

  async shutdown(): Promise<void> {
    const names = [...this.clients.keys()]
    await Promise.all(names.map(name => this.disconnect(name)))
  }

  private notFound(name: string): McpTestResult {
    return { success: false, error: `MCP server "${name}" not found`, testedAt: Date.now() }
  }

  private loadConfigFromDisk(): void {
    try {
      let servers: Record<string, UserMcpServerConfig> = {}
      if (existsSync(this.options.serversFilePath)) {
        const file = JSON.parse(readFileSync(this.options.serversFilePath, 'utf-8')) as UserMcpServersFile
        servers = file.mcpServers || {}
      }

      let state: UserMcpStateFile['servers'] = {}
      if (existsSync(this.options.stateFilePath)) {
        const file = JSON.parse(readFileSync(this.options.stateFilePath, 'utf-8')) as UserMcpStateFile
        state = file.servers || {}
      }

      for (const [name, config] of Object.entries(servers)) {
        const saved = state[name] || { enabled: false }
        this.entries.set(name, {
          config,
          enabled: saved.enabled,
          createdAt: saved.createdAt ?? 0,
          lastTestResult: saved.lastTestResult,
        })
      }

      console.log(`[MCP] Loaded ${this.entries.size} user MCP configs from disk`)
      this.reconnectEnabledServers()
    }
    catch (err: any) {
      console.warn('[MCP] Failed to load user MCP configs:', err.message)
    }
  }

  private reconnectEnabledServers(): void {
    for (const [name, entry] of this.entries) {
      if (!entry.enabled) {
        continue
      }
      this.connectAndTest(name, entry.config).then((result) => {
        if (!result.success) {
          console.warn(`[MCP] Failed to reconnect user MCP "${name}" on startup:`, result.error)
          entry.enabled = false
          entry.lastTestResult = result
          this.saveConfigToDisk()
        }
        else {
          console.log(`[MCP] Reconnected user MCP "${name}" on startup (${result.toolCount} tools)`)
        }
      }).catch((err: any) => {
        console.warn(`[MCP] Unexpected error reconnecting "${name}":`, err.message)
      })
    }
  }

  private saveConfigToDisk(): void {
    try {
      const servers: Record<string, UserMcpServerConfig> = {}
      const state: UserMcpStateFile['servers'] = {}
      for (const [name, entry] of this.entries) {
        servers[name] = entry.config
        state[name] = {
          enabled: entry.enabled,
          createdAt: entry.createdAt,
          lastTestResult: entry.lastTestResult,
        }
      }

      mkdirSync(path.dirname(this.options.serversFilePath), { recursive: true })
      writeFileSync(this.options.serversFilePath, JSON.stringify({ mcpServers: servers }, null, 2), 'utf-8')
      writeFileSync(this.options.stateFilePath, JSON.stringify({ servers: state }, null, 2), 'utf-8')
    }
    catch (err: any) {
      console.warn('[MCP] Failed to save user MCP configs:', err.message)
    }
  }

  private async connectAndTest(name: string, config: UserMcpServerConfig, dryRun = false): Promise<McpTestResult> {
    let client: McpClient | undefined
    try {
      const connection = this.buildConnection(name, config)
      client = new McpClient(connection)
      await client.connect()
      const descriptors = await client.listTools()
      const tools = createRuntimeMcpTools(client, descriptors)
      const exposedToolNames = descriptors.map(tool => tool.name)

      if (dryRun) {
        await client.disconnect().catch(() => {})
      }
      else {
        this.clients.set(name, client)
        this.toolsCache.set(name, tools)
      }

      return {
        success: true,
        toolCount: tools.length,
        toolNames: exposedToolNames,
        testedAt: Date.now(),
      }
    }
    catch (err: any) {
      if (dryRun && client) {
        await client.disconnect().catch(() => {})
      }
      return { success: false, error: err.message, testedAt: Date.now() }
    }
  }

  private async disconnect(name: string): Promise<void> {
    const client = this.clients.get(name)
    if (!client) {
      return
    }
    await client.disconnect().catch((err: any) => {
      console.warn(`[MCP] Error closing user MCP "${name}":`, err.message)
    })
    this.clients.delete(name)
    this.toolsCache.delete(name)
  }
}
