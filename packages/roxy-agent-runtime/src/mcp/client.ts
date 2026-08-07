import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { IMcpClient, McpServerConfig, ToolContext, ToolDescriptor, ToolResult } from "../core/interfaces.ts";

/**
 * MCP client wrapping `@modelcontextprotocol/sdk` over stdio + StreamableHTTP/SSE
 * transports. Lazy connect, list tools, callTool.
 *
 * Pass a `Transport` as the second constructor argument to inject an in-memory
 * transport for tests — avoids spawning real processes.
 */
export class McpClient implements IMcpClient {
  readonly name: string;

  private _connected = false;
  private readonly config: McpServerConfig;
  private readonly injectedTransport?: Transport;
  private readonly sdkClient: Client;

  get connected(): boolean {
    return this._connected;
  }

  constructor(config: McpServerConfig, transport?: Transport) {
    this.name = config.name;
    this.config = config;
    this.injectedTransport = transport;
    this.sdkClient = new Client({ name: config.name, version: "1.0" });
  }

  async connect(): Promise<void> {
    const transport = this.injectedTransport ?? this._buildTransport();
    await this.sdkClient.connect(transport);
    this._connected = true;
  }

  private _buildTransport(): Transport {
    if (this.config.transport === "stdio") {
      if (!this.config.command) {
        throw new Error(`McpClient '${this.name}': stdio transport requires 'command'`);
      }
      return new StdioClientTransport({
        command: this.config.command,
        args: this.config.args,
        env: this.config.env,
      });
    }
    if (!this.config.url) {
      throw new Error(`McpClient '${this.name}': http transport requires 'url'`);
    }
    return new StreamableHTTPClientTransport(new URL(this.config.url));
  }

  async disconnect(): Promise<void> {
    await this.sdkClient.close();
    this._connected = false;
  }

  async listTools(): Promise<ToolDescriptor[]> {
    const result = await this.sdkClient.listTools();
    return result.tools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      inputSchema: (t.inputSchema ?? {
        type: "object",
      }) as Record<string, unknown>,
      source: "mcp" as const,
      metadata: { sensitive: false },
    }));
  }

  async callTool(name: string, input: unknown, ctx: ToolContext, toolUseId: string): Promise<ToolResult> {
    try {
      const result = await this.sdkClient.callTool({
        name,
        arguments: (input ?? {}) as Record<string, unknown>,
      }, undefined, { signal: ctx.signal });
      const rawContent = result.content as Array<{ type: string; text?: string }>;
      const content = rawContent.map((c) => (c.type === "text" && c.text ? c.text : JSON.stringify(c))).join("\n");
      return {
        toolUseId,
        content,
        isError: result.isError === true,
      };
    } catch (err) {
      return {
        toolUseId,
        content: String(err instanceof Error ? err.message : String(err)),
        isError: true,
      };
    }
  }
}
