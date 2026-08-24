import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { ToolDescriptor, ToolHandler } from 'roxy-agent-runtime'
import { McpClient } from 'roxy-agent-runtime'

export interface RuntimeMcpTool {
  descriptor: ToolDescriptor
  handler: ToolHandler
}

export interface RuntimeMcpToolBundle {
  client: McpClient
  tools: RuntimeMcpTool[]
}

/** Connect an MCP SDK transport and expose its tools using the runtime contract. */
export async function createRuntimeMcpToolBundle(
  name: string,
  transport: Transport,
): Promise<RuntimeMcpToolBundle> {
  const client = new McpClient({ name, transport: 'stdio' }, transport)
  await client.connect()
  const descriptors = await client.listTools()
  const tools = createRuntimeMcpTools(client, descriptors)
  return { client, tools }
}

export function createRuntimeMcpTools(
  client: McpClient,
  descriptors: ToolDescriptor[],
): RuntimeMcpTool[] {
  return descriptors.map((descriptor) => {
    return {
      descriptor,
      handler: async (input: unknown, ctx: Parameters<ToolHandler>[1]) =>
        client.callTool(descriptor.name, input, ctx, ctx.toolUseId ?? descriptor.name),
    }
  })
}

export function contentToText(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(item => contentToText(item)).join('\n')
  }
  if (value && typeof value === 'object' && 'text' in value && typeof (value as { text?: unknown }).text === 'string') {
    return (value as { text: string }).text
  }
  return JSON.stringify(value ?? '')
}
