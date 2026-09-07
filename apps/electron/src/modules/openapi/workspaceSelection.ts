interface WorkspaceSelectionDependencies<T> {
  getActiveWorkspaceId: () => string | number | undefined
  getOpenedBrowserCount: () => number
  hasWorkspace: (apiKey: string, workspaceId: string | number) => Promise<boolean>
  getCredentials: (apiKey: string, workspaceId: string | number) => Promise<T>
  requestFrontendSwitch: (workspaceId: string | number) => Promise<string>
}

export function createWorkspaceSelectionService<T>(dependencies: WorkspaceSelectionDependencies<T>) {
  async function select(apiKey: string, workspaceId: string | number, options?: { force?: boolean }) {
    if (!await dependencies.hasWorkspace(apiKey, workspaceId)) {
      throw new Error('workspace not found or inaccessible')
    }

    const alreadyActive = String(dependencies.getActiveWorkspaceId()) === String(workspaceId)
    console.log('[workspace-select] service select', {
      workspaceId,
      alreadyActive,
      force: Boolean(options?.force),
      openedBrowserCount: dependencies.getOpenedBrowserCount(),
    })
    if (!alreadyActive && !options?.force && dependencies.getOpenedBrowserCount() > 0) {
      throw new Error('cannot switch workspace while browser windows are open')
    }

    if (alreadyActive) {
      const credentials = await dependencies.getCredentials(apiKey, workspaceId)
      return { credentials, switched: false as const }
    }

    const requestId = await dependencies.requestFrontendSwitch(workspaceId)
    console.log('[workspace-select] frontend switch acknowledged', { workspaceId, requestId })
    // 目标 APIKey 只能在 Electron 已同步目标 workspaceId 后获取。
    const credentials = await dependencies.getCredentials(apiKey, workspaceId)
    return { credentials, requestId, switched: true as const }
  }

  return { select }
}
