import type { WorkspaceSelectRequestPayload, WorkspaceSelectResultPayload } from '@roxy/electron-preload'
import { randomUUID } from 'node:crypto'

interface WorkspaceSwitchBridgeDependencies {
  sendRequest: (payload: WorkspaceSelectRequestPayload) => Promise<void>
  hasMainWindow: () => boolean
  createRequestId?: () => string
  timeoutMs?: number
}

interface PendingWorkspaceSwitch {
  workspaceId: string | number
  resolve: () => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

export function createWorkspaceSwitchBridge(dependencies: WorkspaceSwitchBridgeDependencies) {
  const pendingRequests = new Map<string, PendingWorkspaceSwitch>()
  const createRequestId = dependencies.createRequestId ?? randomUUID
  const timeoutMs = dependencies.timeoutMs ?? 30_000

  async function request(workspaceId: string | number) {
    if (pendingRequests.size > 0) {
      throw new Error('workspace switch is already in progress')
    }
    if (!dependencies.hasMainWindow()) {
      throw new Error('main window is unavailable')
    }

    const requestId = createRequestId()
    console.log('[workspace-select] ipc request:start', { workspaceId, requestId })
    const { promise, resolve, reject } = Promise.withResolvers<void>()
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId)
      reject(new Error('workspace switch timed out'))
    }, timeoutMs)

    pendingRequests.set(requestId, {
      workspaceId,
      resolve,
      reject,
      timeout,
    })

    try {
      await dependencies.sendRequest({ requestId, workspaceId })
      console.log('[workspace-select] ipc request:sent', { workspaceId, requestId })
    }
    catch (error) {
      clearTimeout(timeout)
      pendingRequests.delete(requestId)
      throw error
    }

    await promise
    return requestId
  }

  function complete(result: WorkspaceSelectResultPayload) {
    console.log('[workspace-select] ipc result', {
      requestId: result.requestId,
      workspaceId: result.workspaceId,
      success: result.success,
      error: result.error,
    })
    const pending = pendingRequests.get(result.requestId)
    if (!pending) {
      return false
    }

    clearTimeout(pending.timeout)
    pendingRequests.delete(result.requestId)

    if (!result.success) {
      pending.reject(new Error(result.error || 'workspace switch failed'))
      return true
    }
    if (String(result.workspaceId) !== String(pending.workspaceId)) {
      pending.reject(new Error('workspace switch returned an unexpected workspace'))
      return true
    }

    pending.resolve()
    return true
  }

  return { request, complete }
}
