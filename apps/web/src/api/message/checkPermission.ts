import type { AxiosResponse } from 'axios'
import { useWorkspaceStore } from '/@/stores/workspace'

/** 上一次版本 */
let lastVersion = ''
let isCheckingVersion = false

export async function checkPermission(response: AxiosResponse<any, any>) {
  const remoteVersion = response.headers.r_user_permission

  if (!lastVersion) {
    lastVersion = remoteVersion
    return
  }

  if (isCheckingVersion) {
    return
  }

  if (remoteVersion > lastVersion) {
    console.log('checkPermissionVersion', remoteVersion, lastVersion)

    const workspaceStore = useWorkspaceStore()
    if (workspaceStore.isSwitchingWorkspace) {
      lastVersion = remoteVersion
      return
    }

    if (!workspaceStore.currentWorkspace?.id)
      return

    isCheckingVersion = true
    lastVersion = remoteVersion

    workspaceStore.getPermissionByWorkspace(workspaceStore.currentWorkspace.id).finally(() => {
      isCheckingVersion = false
    })
  }
}
