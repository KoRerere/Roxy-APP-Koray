import type { McpClient, ToolContext, ToolDescriptor } from 'roxy-agent-runtime'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createRuntimeMcpTools } from './runtimeMcpTool'

const context: ToolContext = {
  agentId: 'agent',
  traceId: 'trace',
  toolUseId: 'tool-use',
  signal: new AbortController().signal,
}

describe('runtime MCP tool adapter', () => {
  it('preserves runtime-owned MCP names without adding another prefix', async () => {
    // Regression: roxy-agent added its own optional prefix after McpClient
    // listed tools, producing inconsistent names across MCP registration paths.
    // Fixed by: treating the runtime descriptor name as the only exposed name.
    const callTool = vi.fn(async () => ({ content: 'ok', isError: false }))
    const client = { name: 'demo-server', callTool } as unknown as McpClient
    const descriptors: ToolDescriptor[] = [{
      name: 'mcp_demo-server__echo',
      description: 'echo',
      inputSchema: z.strictObject({}),
      source: 'mcp',
    }]

    const tools = createRuntimeMcpTools(client, descriptors)

    expect(tools.map(tool => tool.descriptor.name)).toEqual(['mcp_demo-server__echo'])
    await tools[0]!.handler({}, context)
    expect(callTool).toHaveBeenCalledWith('mcp_demo-server__echo', {}, context, 'tool-use')
  })
})
