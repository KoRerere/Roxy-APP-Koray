import { nextTick, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '/@/stores/workspace'
import { isMainWindow } from '/@/utils'

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }
  return typeof error === 'string' ? error : 'workspace switch failed'
}

export function useElectronWorkspaceSelection() {
  if (!globalThis.isElectron || !isMainWindow) {
    return
  }

  const workspaceStore = useWorkspaceStore()
  const router = useRouter()
  const removeRequestedListener = globalThis.electronAPI.on(
    'user:workspace-select-requested',
    async ({ requestId, workspaceId }) => {
      console.log('[workspace-select] renderer request received', { requestId, workspaceId })
      const numericWorkspaceId = Number(workspaceId)
      try {
        if (!Number.isSafeInteger(numericWorkspaceId) || numericWorkspaceId <= 0) {
          throw new Error('workspaceId must be a positive integer')
        }

        await workspaceStore.setCurrentWorkspace(numericWorkspaceId, {
          restartApiServer: false,
        })
        await nextTick()

        console.log('[workspace-select] renderer workspace state', {
          requestedWorkspaceId: numericWorkspaceId,
          currentWorkspaceId: workspaceStore.currentWorkspace?.id,
          workspaceIds: workspaceStore.workspaceList.map(item => item.id),
        })
        if (String(workspaceStore.currentWorkspace?.id) !== String(numericWorkspaceId)) {
          throw new Error('workspace not found or inaccessible')
        }

        await router.push({ name: 'browser' })

        await globalThis.electronAPI.send(
          'user:setWorkspaceId',
          numericWorkspaceId,
          workspaceStore.currentWorkspace.workspaceType,
        )
        await globalThis.electronAPI.send('mcp:close').catch((error) => {
          console.error('Failed to close MCP after workspace switch:', error)
        })
        await globalThis.electronAPI.send('user:workspace-select-result', {
          requestId,
          workspaceId: numericWorkspaceId,
          success: true,
        })
        console.log('[workspace-select] renderer request succeeded', { requestId, workspaceId: numericWorkspaceId })
      }
      catch (error) {
        console.error('[workspace-select] renderer request failed', { requestId, workspaceId, error })
        await globalThis.electronAPI.send('user:workspace-select-result', {
          requestId,
          workspaceId,
          success: false,
          error: getErrorMessage(error),
        }).catch((ackError) => {
          console.error('Failed to report workspace switch result:', ackError)
        })
      }
    },
  )

  const removeCompletedListener = globalThis.electronAPI.on(
    'user:workspace-select-completed',
    () => {
      void globalThis.electronAPI.send('app:restartAPIServer')
    },
  )

  onUnmounted(() => {
    removeRequestedListener()
    removeCompletedListener()
  })
}
