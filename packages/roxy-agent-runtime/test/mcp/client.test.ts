import { describe, expect, it } from 'vitest'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { McpClient } from '../../src/mcp/client.ts'
import { McpServerRegistry } from '../../src/mcp/registry.ts'

// ---------------------------------------------------------------------------
// In-process MCP server fixture
// ---------------------------------------------------------------------------

async function startEchoServer(): Promise<{
  serverTransport: Transport
  cleanup: () => Promise<void>
}> {
  const server = new Server({ name: 'echo-server', version: '1.0' }, { capabilities: { tools: {} } })

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'echo',
        description: 'Echo input back',
        inputSchema: {
          type: 'object',
          properties: { msg: { type: 'string' } },
          required: ['msg'],
        },
        annotations: {
          title: 'Echo input',
          readOnlyHint: true,
          openWorldHint: false,
        },
      },
    ],
  }))

  server.setRequestHandler(CallToolRequestSchema, async (req) => ({
    content: [
      {
        type: 'text',
        text: `echo: ${(req.params.arguments as Record<string, string>).msg}`,
      },
    ],
  }))

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  return {
    serverTransport: clientTransport,
    cleanup: async () => {
      await server.close()
    },
  }
}

const ctx = {
  agentId: 'a1',
  traceId: 't1',
  signal: new AbortController().signal,
}

// ---------------------------------------------------------------------------
// McpClient
// ---------------------------------------------------------------------------

describe('McpClient', () => {
  it('connected starts false, true after connect()', async () => {
    const { serverTransport, cleanup } = await startEchoServer()
    const client = new McpClient({ name: 'test', transport: 'stdio' }, serverTransport)
    expect(client.connected).toBe(false)
    await client.connect()
    expect(client.connected).toBe(true)
    await client.disconnect()
    await cleanup()
  })

  it('disconnect() sets connected = false', async () => {
    const { serverTransport, cleanup } = await startEchoServer()
    const client = new McpClient({ name: 'test', transport: 'stdio' }, serverTransport)
    await client.connect()
    await client.disconnect()
    expect(client.connected).toBe(false)
    await cleanup()
  })

  it("listTools() returns ToolDescriptors with source:'mcp'", async () => {
    // Regression: MCP tools previously kept their server-local names, so
    // different servers could collide after entering one ToolRegistry.
    // Fixed by: naming every listed tool mcp_{server-name}__{tool-name}.
    const { serverTransport, cleanup } = await startEchoServer()
    const client = new McpClient({ name: 'test', transport: 'stdio' }, serverTransport)
    await client.connect()
    const tools = await client.listTools()
    expect(tools).toHaveLength(1)
    expect(tools[0]).toMatchObject({ name: 'mcp_test__echo', source: 'mcp' })
    expect(tools[0]!.annotations).toEqual({
      title: 'Echo input',
      readOnlyHint: true,
      openWorldHint: false,
    })
    expect(tools[0]!.metadata).toBeUndefined()
    expect(tools[0]!.inputSchema.safeParse({ msg: 'hello' }).success).toBe(true)
    expect(tools[0]!.inputSchema.safeParse({}).success).toBe(false)
    await client.disconnect()
    await cleanup()
  })

  it('callTool() returns ToolResult with content', async () => {
    const { serverTransport, cleanup } = await startEchoServer()
    const client = new McpClient({ name: 'test', transport: 'stdio' }, serverTransport)
    await client.connect()
    const result = await client.callTool('mcp_test__echo', { msg: 'hello' }, ctx, 'tu1')
    expect(result.isError).toBe(false)
    expect(result.content).toContain('hello')
    await client.disconnect()
    await cleanup()
  })
})

// ---------------------------------------------------------------------------
// McpServerRegistry
// ---------------------------------------------------------------------------

describe('McpServerRegistry', () => {
  it('load([]) + tools() = []', async () => {
    const registry = new McpServerRegistry()
    await registry.load([])
    expect(registry.tools()).toEqual([])
  })

  it('load(configs) via transport factory + tools() + disconnectAll()', async () => {
    const { serverTransport, cleanup } = await startEchoServer()

    const registry = new McpServerRegistry((config) => new McpClient(config, serverTransport))
    await registry.load([{ name: 'echo-server', transport: 'stdio' }])

    const tools = registry.tools()
    expect(tools.some((t) => t.name === 'mcp_echo-server__echo')).toBe(true)
    expect(tools[0]).toMatchObject({ source: 'mcp' })

    await registry.disconnectAll()
    await cleanup()
  })
})
