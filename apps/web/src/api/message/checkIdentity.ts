import type { AxiosResponse } from 'axios'
import { useWorkspaceStore } from '/@/stores/workspace'

// R-USER-IDENTITY：查看者:0 编辑者:1 管理者:2 拥有者：3 用户身份权限
// R-USER-PRIVILEGE：Free/Basic/Pro/Business/Enterprise 用户权益权限

let isCheckingUserIdentity = false

// 某些接口不检查身份变化
const ignore = [
  '/user_logout',
]

export async function checkIdentity(response: AxiosResponse<any, any>) {
  const userIdentity = Number(response.headers['r-user-identity'])

  const workspaceStore = useWorkspaceStore()
  const { currentWorkspace, getWorkspaceList } = workspaceStore

  if (workspaceStore.isSwitchingWorkspace)
    return

  if (!currentWorkspace?.id || ignore.includes(response.config.url!)) {
    return
  }

  if (!isCheckingUserIdentity && currentWorkspace?.role !== userIdentity) {
    isCheckingUserIdentity = true
    getWorkspaceList().finally(() => {
      isCheckingUserIdentity = false
    })
    console.log('Workspace role changed, re-fetching workspace list')
  }
}
