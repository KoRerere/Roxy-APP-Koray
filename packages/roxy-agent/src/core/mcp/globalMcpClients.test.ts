import assert from 'node:assert/strict'
import { afterEach, beforeEach, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  clientConnect: vi.fn(),
  createLinkedPair: vi.fn(() => ['client-transport', 'server-transport']),
  createRuntimeMcpToolBundle: vi.fn(async () => ({ tools: [] })),
  serverConnect: vi.fn(),
  serverOptions: [] as any[],
}))

vi.mock('@modelcontextprotocol/sdk/inMemory.js', () => ({
  InMemoryTransport: {
    createLinkedPair: mocks.createLinkedPair,
  },
}))

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn(() => {
    return {
      connect: mocks.clientConnect,
    }
  }),
}))

vi.mock('./runtimeMcpTool', () => ({
  createRuntimeMcpToolBundle: mocks.createRuntimeMcpToolBundle,
}))

vi.mock('@roxybrowser/openapi', () => ({
  createRoxyBrowserMcpServer: vi.fn((options) => {
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
  mocks.createRuntimeMcpToolBundle.mockClear()
  mocks.serverConnect.mockClear()
  mocks.serverOptions.length = 0
  process.env.ROXY_API_HOST = 'http://127.0.0.1:26580'
  process.env.ROXY_API_KEY = 'api-key'
  process.env.ROXY_WORKSPACE_ID = '42'
})

afterEach(() => {
  if (originalApiHost === undefined) {
    delete process.env.ROXY_API_HOST
  }
  else {
    process.env.ROXY_API_HOST = originalApiHost
  }
  if (originalApiKey === undefined) {
    delete process.env.ROXY_API_KEY
  }
  else {
    process.env.ROXY_API_KEY = originalApiKey
  }
  if (originalWorkspaceId === undefined) {
    delete process.env.ROXY_WORKSPACE_ID
  }
  else {
    process.env.ROXY_WORKSPACE_ID = originalWorkspaceId
  }
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
    excludeTools: ['roxy_profile_open'],
  })
})

it('can omit the FAQ MCP for callers using Responses web search', async () => {
  const { getGlobalMcpTools } = await import('./globalMcpClients')

  await getGlobalMcpTools({ includeFaq: false })

  assert.equal(mocks.createRuntimeMcpToolBundle.mock.calls.length, 1)
  assert.equal(mocks.serverConnect.mock.calls.length, 1)
})

it('keeps the FAQ MCP disabled even when a legacy caller opts in', async () => {
  const { getGlobalMcpTools } = await import('./globalMcpClients')

  await getGlobalMcpTools({ includeFaq: true })

  assert.equal(mocks.createRuntimeMcpToolBundle.mock.calls.length, 1)
  assert.equal(mocks.serverConnect.mock.calls.length, 1)
})
