import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  acquireBrowserAutomationControl,
  releaseBrowserAutomationControl,
  syncBrowserAutomationControl,
} from './browserAutomationControl'

const { request, RoxyBrowserClient } = vi.hoisted(() => {
  const request = vi.fn()
  class RoxyBrowserClientMock {
    readonly api = { transport: { request } }
  }
  return {
    request,
    RoxyBrowserClient: vi.fn(RoxyBrowserClientMock),
  }
})

vi.mock('@roxybrowser/openapi', () => ({ RoxyBrowserClient }))

vi.mock('@/config', () => ({
  env: {
    ROXY_API_HOST: 'http://127.0.0.1:50000',
    ROXY_API_KEY: 'api-key',
    ROXY_WORKSPACE_ID: '42',
  },
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('browser automation control client', () => {
  it('calls sync and release with the execution owner and active target', async () => {
    request.mockResolvedValue({ code: 0, data: {} })

    await syncBrowserAutomationControl('profile-1', 'run-1', 'target-1')
    await releaseBrowserAutomationControl('profile-1', 'run-1')

    expect(RoxyBrowserClient).toHaveBeenCalledWith({
      baseUrl: 'http://127.0.0.1:50000',
      apiKey: 'api-key',
      workspaceId: 42,
    })
    expect(request.mock.calls.map(([options]) => options)).toEqual([
      {
        method: 'POST',
        path: '/browser/automation/sync',
        params: { dirId: 'profile-1', executionId: 'run-1', targetId: 'target-1', label: 'AI' },
      },
      {
        method: 'POST',
        path: '/browser/automation/release',
        params: { dirId: 'profile-1', executionId: 'run-1' },
      },
    ])
  })

  it('keeps acquire available for an older desktop protocol', async () => {
    request.mockResolvedValue({ code: 0, data: {} })

    await acquireBrowserAutomationControl('profile-1', 'run-1')

    expect(request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/browser/automation/acquire',
      params: { dirId: 'profile-1', executionId: 'run-1', label: 'AI' },
    })
  })

  it('never rejects when an older Electron lacks the endpoints', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    request
      .mockRejectedValueOnce(new Error('404 Not Found'))
      .mockRejectedValueOnce(new Error('connection reset'))

    await expect(acquireBrowserAutomationControl('profile-1', 'run-1')).resolves.toBe(false)
    await expect(releaseBrowserAutomationControl('profile-1', 'run-1')).resolves.toBe(false)
    expect(warn).toHaveBeenCalledTimes(2)
  })
})
