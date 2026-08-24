import type { ToolContext, ToolDescriptor, ToolResult } from './tools.ts'

// ---------------------------------------------------------------------------
// MCP
// ---------------------------------------------------------------------------

export type McpTransport = 'stdio' | 'http'

export interface McpServerConfig {
  name: string
  transport: McpTransport
  /** stdio: command + args. */
  command?: string
  args?: string[]
  env?: Record<string, string>
  /** http: base URL + optional bearer token. */
  url?: string
  token?: string
  headers?: Record<string, string>
}

export interface IMcpClient {
  readonly name: string
  connect(): Promise<void>
  disconnect(): Promise<void>
  readonly connected: boolean
  listTools(): Promise<ToolDescriptor[]>
  callTool(name: string, input: unknown, ctx: ToolContext, toolUseId: string): Promise<ToolResult>
}

export interface IMcpServerRegistry {
  /** Load server configs, lazily connect, and enumerate tools. */
  load(configs: McpServerConfig[]): Promise<void>
  /** All remote tools unified as ToolDescriptors (source: 'mcp'). */
  tools(): ToolDescriptor[]
  disconnectAll(): Promise<void>
}
