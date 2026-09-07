import { describe, expect, it, vi } from 'vitest'
import { createWorkspaceCredentialsService } from './workspaceCredentials'

function createService() {
  const listWorkspaces = vi.fn(async () => ({
    code: 0,
    msg: 'ok',
    data: {
      total: 2,
      rows: [
        { id: '10', userId: 1, workspaceName: 'Alpha', project_details: [] },
        { id: '20', userId: 1, workspaceName: 'Beta', project_details: [] },
        { id: '30', userId: 1, workspaceName: 'Broken', project_details: [] },
      ],
    },
  }))
  const getWorkspaceApiKey = vi.fn(async (workspaceId: string | number) => ({
    code: String(workspaceId) === '30' ? 404 : 0,
    msg: String(workspaceId) === '30' ? 'workspace inaccessible' : 'ok',
    data: {
      apiKey: String(workspaceId) === '20' ? 'beta-key' : 'alpha-key',
      port: String(workspaceId) === '20' ? 50001 : 50000,
      open: true,
      apiRate: 50,
    },
  }))
  return {
    service: createWorkspaceCredentialsService({ listWorkspaces, getWorkspaceApiKey }),
    listWorkspaces,
    getWorkspaceApiKey,
  }
}

describe('workspaceCredentialsService', () => {
  it('验证访问权限并返回目标空间的真实 APIKey', async () => {
    const { service, listWorkspaces, getWorkspaceApiKey } = createService()

    await expect(service.select('current-key', 20)).resolves.toEqual({
      workspace: { id: '20', workspaceName: 'Beta', project_details: [] },
      apiKey: 'beta-key',
      port: 50001,
      open: true,
      apiRate: 50,
    })
    expect(listWorkspaces).toHaveBeenCalledWith('current-key')
    expect(getWorkspaceApiKey).toHaveBeenCalledWith(20)
  })

  it('拒绝当前 APIKey 无权访问的空间', async () => {
    const { service, getWorkspaceApiKey } = createService()

    await expect(service.select('current-key', 30)).rejects.toThrow('workspace inaccessible')
    expect(getWorkspaceApiKey).toHaveBeenCalledWith(30)
  })

  it('空间列表中不存在时拒绝切换且不请求目标配置', async () => {
    const { service, getWorkspaceApiKey } = createService()

    await expect(service.hasWorkspace('current-key', 40)).resolves.toBe(false)
    await expect(service.select('current-key', 40)).rejects.toThrow('workspace not found or inaccessible')
    expect(getWorkspaceApiKey).not.toHaveBeenCalledWith(40)
  })

  it('根据 APIKey 匹配当前 active 空间且不返回 APIKey', async () => {
    const { service } = createService()

    const workspace = await service.getActive('beta-key')
    expect(workspace).toEqual({ id: '20', workspaceName: 'Beta', project_details: [], port: 50001 })
    expect(workspace).not.toHaveProperty('apiKey')
    expect(workspace).not.toHaveProperty('userId')
  })

  it('无法匹配 APIKey 时返回明确错误', async () => {
    const { service } = createService()
    await expect(service.getActive('unknown-key')).rejects.toThrow('active workspace not found')
  })
})
