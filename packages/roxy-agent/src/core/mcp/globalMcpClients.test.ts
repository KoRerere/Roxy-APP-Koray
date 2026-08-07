import assert from 'node:assert/strict'
import { afterEach, beforeEach, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  clientConnect: vi.fn(),
  createLinkedPair: vi.fn(() => ['client-transport', 'server-transport']),
  loadMcpTools: vi.fn(async () => []),
  serverConnect: vi.fn(),
  serverOptions: [] as any[],
}))

vi.mock('@modelcontextprotocol/sdk/inMemory.js', () => ({
  InMemoryTransport: {
    createLinkedPair: mocks.createLinkedPair,
  },
}))

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn(function () {
    return {
      connect: mocks.clientConnect,
    }
  }),
}))

vi.mock('@langchain/mcp-adapters', () => ({
  loadMcpTools: mocks.loadMcpTools,
  MultiServerMCPClient: vi.fn(),
}))

vi.mock('@roxybrowser/openapi', () => ({
  createRoxyMcpServer: vi.fn((options) => {
    mocks.serverOptions.push(options)
    return {
      connect: mocks.serverConnect,
    }
  }),
}))

const originalApiHost = process.env.ROXY_API_HOST
const originalApiKey = process.env.ROXY_API_KEY
const originalWorkspaceId = process.env.ROXY_WORKSPACE_ID

beforeEach(() => {
  vi.resetModules()
  mocks.clientConnect.mockClear()
  mocks.createLinkedPair.mockClear()
  mocks.loadMcpTools.mockClear()
  mocks.serverConnect.mockClear()
  mocks.serverOptions.length = 0
  process.env.ROXY_API_HOST = 'http://127.0.0.1:26580'
  process.env.ROXY_API_KEY = 'api-key'
  process.env.ROXY_WORKSPACE_ID = '42'
})

afterEach(() => {
  if (originalApiHost === undefined)
    delete process.env.ROXY_API_HOST
  else
    process.env.ROXY_API_HOST = originalApiHost
  if (originalApiKey === undefined)
    delete process.env.ROXY_API_KEY
  else
    process.env.ROXY_API_KEY = originalApiKey
  if (originalWorkspaceId === undefined)
    delete process.env.ROXY_WORKSPACE_ID
  else
    process.env.ROXY_WORKSPACE_ID = originalWorkspaceId
})

it('binds the current workspace id into the embedded OpenAPI MCP server context', async () => {
  const { getOpenApiTools } = await import('./globalMcpClients')

  await getOpenApiTools()

  assert.deepEqual(mocks.serverOptions[0], {
    roxy: {
      apiHost: 'http://127.0.0.1:26580',
      apiKey: 'api-key',
    },
    context: {
      workspaceId: 42,
    },
  })
})
