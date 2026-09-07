import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWorkspaceSwitchBridge } from './workspaceSwitchBridge'

afterEach(() => {
  vi.useRealTimers()
})

function createBridge(options?: { hasMainWindow?: boolean, timeoutMs?: number }) {
  const sendRequest = vi.fn(async () => {})
  const bridge = createWorkspaceSwitchBridge({
    sendRequest,
    hasMainWindow: () => options?.hasMainWindow ?? true,
    createRequestId: () => 'request-1',
    timeoutMs: options?.timeoutMs ?? 100,
  })
  return { bridge, sendRequest }
}

describe('workspaceSwitchBridge', () => {
  it('发送请求并等待前端成功回执', async () => {
    const { bridge, sendRequest } = createBridge()
    const request = bridge.request(20)

    expect(sendRequest).toHaveBeenCalledWith({ requestId: 'request-1', workspaceId: 20 })
    expect(bridge.complete({ requestId: 'request-1', workspaceId: 20, success: true })).toBe(true)
    await expect(request).resolves.toBe('request-1')
  })

  it('将前端切换失败传回调用方', async () => {
    const { bridge } = createBridge()
    const request = bridge.request(20)

    bridge.complete({
      requestId: 'request-1',
      workspaceId: 20,
      success: false,
      error: 'permission denied',
    })
    await expect(request).rejects.toThrow('permission denied')
  })

  it('主窗口不存在时直接拒绝', async () => {
    const { bridge, sendRequest } = createBridge({ hasMainWindow: false })

    await expect(bridge.request(20)).rejects.toThrow('main window is unavailable')
    expect(sendRequest).not.toHaveBeenCalled()
  })

  it('前端未回执时超时并清理请求', async () => {
    vi.useFakeTimers()
    const { bridge } = createBridge({ timeoutMs: 10 })
    const assertion = expect(bridge.request(20)).rejects.toThrow('workspace switch timed out')

    await vi.advanceTimersByTimeAsync(10)
    await assertion
  })
})
