import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { IMcpClient, McpServerConfig, ToolContext, ToolDescriptor, ToolResult } from '../core/interfaces.ts'
import { jsonSchemaToZod } from '../tools/schema.ts'
import { mcpToolName, mcpToolNamePrefix } from './tool-name.ts'

/**
 * MCP client wrapping `@modelcontextprotocol/sdk` over stdio + StreamableHTTP/SSE
 * transports. Lazy connect, list tools, callTool.
 *
 * Pass a `Transport` as the second constructor argument to inject an in-memory
 * transport for tests — avoids spawning real processes.
 */
export class McpClient implements IMcpClient {
  readonly name: string

  private _connected = false
  private readonly config: McpServerConfig
  private readonly injectedTransport?: Transport
  private readonly sdkClient: Client
  private readonly originalToolNames = new Map<string, string>()

  get connected(): boolean {
    return this._connected
  }

  constructor(config: McpServerConfig, transport?: Transport) {
    this.name = config.name
    this.config = config
    this.injectedTransport = transport
    this.sdkClient = new Client({ name: config.name, version: '1.0' })
  }

  async connect(): Promise<void> {
    const transport = this.injectedTransport ?? this._buildTransport()
    await this.sdkClient.connect(transport)
    this._connected = true
  }

  private _buildTransport(): Transport {
    if (this.config.transport === 'stdio') {
      if (!this.config.command) {
        throw new Error(`McpClient '${this.name}': stdio transport requires 'command'`)
      }
      return new StdioClientTransport({
        command: this.config.command,
        args: this.config.args,
        env: this.config.env,
      })
    }
    if (!this.config.url) {
      throw new Error(`McpClient '${this.name}': http transport requires 'url'`)
    }
    return new StreamableHTTPClientTransport(new URL(this.config.url), {
      requestInit: this.config.headers ? { headers: this.config.headers } : undefined,
    })
  }

  async disconnect(): Promise<void> {
    await this.sdkClient.close()
    this.originalToolNames.clear()
    this._connected = false
  }

  async listTools(): Promise<ToolDescriptor[]> {
    const result = await this.sdkClient.listTools()
    this.originalToolNames.clear()
    return result.tools.map((tool) => {
      const exposedName = mcpToolName(this.name, tool.name)
      this.originalToolNames.set(exposedName, tool.name)
      return {
        name: exposedName,
        description: tool.description ?? '',
        inputSchema: jsonSchemaToZod(tool.inputSchema),
        source: 'mcp' as const,
        annotations: tool.annotations,
      }
    })
  }

  async callTool(name: string, input: unknown, ctx: ToolContext, toolUseId: string): Promise<ToolResult> {
    const prefix = mcpToolNamePrefix(this.name)
    const originalName =
      this.originalToolNames.get(name) ??
      (name.startsWith(prefix) && name.length > prefix.length ? name.slice(prefix.length) : undefined)
    if (!originalName) {
      return {
        toolUseId,
        content: `MCP tool '${name}' is not registered for server '${this.name}'`,
        isError: true,
      }
    }

    try {
      const result = await this.sdkClient.callTool(
        {
          name: originalName,
          arguments: (input ?? {}) as Record<string, unknown>,
        },
        undefined,
        { signal: ctx.signal },
      )
      const rawContent = result.content as Array<{ type: string; text?: string }>
      const content = rawContent.map((c) => (c.type === 'text' && c.text ? c.text : JSON.stringify(c))).join('\n')
      return {
        toolUseId,
        content,
        isError: result.isError === true,
      }
    } catch (err) {
      return {
        toolUseId,
        content: String(err instanceof Error ? err.message : String(err)),
        isError: true,
      }
    }
  }
}
