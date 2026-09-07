import { describe, expect, it, vi } from 'vitest'
import { createWorkspaceSelectionService } from './workspaceSelection'

function createService(options?: { activeWorkspaceId?: number, openedBrowserCount?: number }) {
  const getCredentials = vi.fn(async (_apiKey: string, workspaceId: string | number) => ({
    workspace: { id: workspaceId },
    apiKey: `key-${workspaceId}`,
  }))
  const requestFrontendSwitch = vi.fn(async () => 'request-1')
  const hasWorkspace = vi.fn(async (_apiKey: string, workspaceId: string | number) => String(workspaceId) !== '30')
  const service = createWorkspaceSelectionService({
    getActiveWorkspaceId: () => options?.activeWorkspaceId ?? 10,
    getOpenedBrowserCount: () => options?.openedBrowserCount ?? 0,
    hasWorkspace,
    getCredentials,
    requestFrontendSwitch,
  })

  return { service, getCredentials, requestFrontendSwitch, hasWorkspace }
}

describe('workspaceSelectionService', () => {
  it('没有已打开窗口时由前端切换并返回真实 APIKey', async () => {
    const { service, requestFrontendSwitch } = createService()

    await expect(service.select('current-key', 20)).resolves.toEqual({
      credentials: {
        workspace: { id: 20 },
        apiKey: 'key-20',
      },
      requestId: 'request-1',
      switched: true,
    })
    expect(requestFrontendSwitch).toHaveBeenCalledWith(20)
  })

  it('非强制模式下有已打开窗口时拒绝且不通知前端', async () => {
    const { service, getCredentials, requestFrontendSwitch } = createService({ openedBrowserCount: 1 })

    await expect(service.select('current-key', 20)).rejects.toThrow(
      'cannot switch workspace while browser windows are open',
    )
    expect(getCredentials).not.toHaveBeenCalled()
    expect(requestFrontendSwitch).not.toHaveBeenCalled()
  })

  it('强制模式忽略已打开窗口并通知前端切换', async () => {
    const { service, requestFrontendSwitch } = createService({ openedBrowserCount: 1 })

    await expect(service.select('current-key', 20, { force: true })).resolves.toMatchObject({
      switched: true,
    })
    expect(requestFrontendSwitch).toHaveBeenCalledWith(20)
  })

  it('目标已经是 active 空间时保持幂等且不受窗口状态影响', async () => {
    const { service, requestFrontendSwitch } = createService({
      activeWorkspaceId: 20,
      openedBrowserCount: 1,
    })

    await expect(service.select('current-key', '20')).resolves.toMatchObject({
      credentials: { apiKey: 'key-20' },
      switched: false,
    })
    expect(requestFrontendSwitch).not.toHaveBeenCalled()
  })

  it('目标空间不存在时在通知前端之前拒绝', async () => {
    const { service, requestFrontendSwitch, getCredentials } = createService()

    await expect(service.select('current-key', 30)).rejects.toThrow('workspace not found or inaccessible')
    expect(requestFrontendSwitch).not.toHaveBeenCalled()
    expect(getCredentials).not.toHaveBeenCalled()
  })
})
