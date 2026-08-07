import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type {
  IMcpServerRegistry,
  McpServerConfig,
  ToolContext,
  ToolDescriptor,
  ToolResult,
} from "../core/interfaces.ts";
import { McpClient } from "./client.ts";

/** Factory function that creates a McpClient from a config (and optional transport). */
export type McpClientFactory = (config: McpServerConfig, transport?: Transport) => McpClient;

const defaultFactory: McpClientFactory = (config) => new McpClient(config);

/**
 * Config-driven registry of remote MCP servers. Connects all servers on
 * `load()`, aggregates their tool lists, and disconnects all on `disconnectAll()`.
 *
 * Pass a `clientFactory` for test injection (e.g. in-memory transports).
 */
export class McpServerRegistry implements IMcpServerRegistry {
  private readonly clientFactory: McpClientFactory;
  private clients: McpClient[] = [];
  private _tools: ToolDescriptor[] = [];
  private readonly toolToClient = new Map<string, McpClient>();

  constructor(clientFactory?: McpClientFactory) {
    this.clientFactory = clientFactory ?? defaultFactory;
  }

  async load(configs: McpServerConfig[]): Promise<void> {
    this.clients = configs.map((c) => this.clientFactory(c));
    await Promise.all(this.clients.map((c) => c.connect()));
    const toolLists = await Promise.all(this.clients.map((c) => c.listTools()));
    this._tools = [];
    this.toolToClient.clear();
    for (let i = 0; i < this.clients.length; i++) {
      const client = this.clients[i]!;
      for (const tool of toolLists[i]!) {
        this._tools.push(tool);
        this.toolToClient.set(tool.name, client);
      }
    }
  }

  tools(): ToolDescriptor[] {
    return [...this._tools];
  }

  /** Dispatch a tool call to the appropriate MCP client. */
  async callTool(name: string, input: unknown, ctx: ToolContext, toolUseId: string): Promise<ToolResult> {
    const client = this.toolToClient.get(name);
    if (!client) {
      return {
        toolUseId,
        content: `MCP tool '${name}' not found in any connected server`,
        isError: true,
      };
    }
    return client.callTool(name, input, ctx, toolUseId);
  }

  async disconnectAll(): Promise<void> {
    await Promise.all(this.clients.map((c) => c.disconnect()));
    this.clients = [];
    this._tools = [];
    this.toolToClient.clear();
  }
}
