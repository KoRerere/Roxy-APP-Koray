import { beforeEach, describe, expect, it, vi } from 'vitest'

const { RoxyBrowserClient } = vi.hoisted(() => ({
  RoxyBrowserClient: vi.fn(class RoxyBrowserClientMock {
    readonly profiles = {}
  }),
}))

vi.mock('@roxybrowser/openapi', () => ({ RoxyBrowserClient }))

vi.mock('@/config', () => ({
  env: {
    ROXY_API_HOST: 'http://127.0.0.1:50000',
    ROXY_API_KEY: 'api-key',
    ROXY_WORKSPACE_ID: '42',
  },
}))

beforeEach(() => {
  vi.resetModules()
  RoxyBrowserClient.mockReset()
})

describe('getRoxyBrowserClient', () => {
  it('creates and reuses one configured SDK client', async () => {
    const { getRoxyBrowserClient } = await import('./roxyBrowserClient')

    const first = getRoxyBrowserClient()
    expect(getRoxyBrowserClient()).toBe(first)
    expect(RoxyBrowserClient).toHaveBeenCalledTimes(1)
    expect(RoxyBrowserClient).toHaveBeenCalledWith({
      baseUrl: 'http://127.0.0.1:50000',
      apiKey: 'api-key',
      workspaceId: 42,
    })
  })
})
