import assert from 'node:assert/strict'
import { afterEach, describe, it, vi } from 'vitest'
import { closeTaskBrowserWindows } from './windowLifecycle'

const fetchMock = vi.fn()

vi.mock('@/config', () => ({
  env: {
    ROXY_API_HOST: 'http://127.0.0.1:50000',
    ROXY_API_KEY: 'api-key',
  },
}))

vi.stubGlobal('fetch', fetchMock)

afterEach(() => {
  vi.clearAllMocks()
})

describe('closeTaskBrowserWindows', () => {
  it('closes every unique task window through the local browser API', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ code: 0 }),
    })

    const closed = await closeTaskBrowserWindows([
      { id: 1, dirId: 'window-a' },
      { id: 2, dirId: 'window-b' },
      { id: 3, dirId: 'window-a' },
    ])

    assert.deepEqual(closed, ['window-a', 'window-b'])
    assert.equal(fetchMock.mock.calls.length, 2)
    assert.deepEqual(fetchMock.mock.calls.map(call => JSON.parse(call[1].body)), [
      { dirId: 'window-a' },
      { dirId: 'window-b' },
    ])
    for (const [url, options] of fetchMock.mock.calls) {
      assert.equal(url, 'http://127.0.0.1:50000/browser/close')
      assert.equal(options.method, 'POST')
      assert.equal(options.headers.token, 'api-key')
    }
  })

  it('continues closing remaining windows when one close fails', async () => {
    const closeWindow = vi.fn(async (dirId: string) => {
      if (dirId === 'window-b') {
        throw new Error('close failed')
      }
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const closed = await closeTaskBrowserWindows([
      { id: 1, dirId: 'window-a' },
      { id: 2, dirId: 'window-b' },
      { id: 3, dirId: 'window-c' },
    ], closeWindow)

    assert.deepEqual(closed, ['window-a', 'window-c'])
    assert.deepEqual(closeWindow.mock.calls.map(call => call[0]), [
      'window-a',
      'window-b',
      'window-c',
    ])
    assert.equal(warn.mock.calls.length, 1)
    assert.match(String(warn.mock.calls[0][0]), /window-b/)
  })

  it('does not call the browser API for tasks without windows', async () => {
    await closeTaskBrowserWindows([])

    assert.equal(fetchMock.mock.calls.length, 0)
  })
})
