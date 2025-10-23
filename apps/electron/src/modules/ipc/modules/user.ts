

import path from "path"
import { browserManager } from "/@/modules/browser"
import { IPCMainInstance } from "/@/modules/ipc/types"
import { openAPIServer } from "/@/modules/openapi"
import { fetchUserConfig, store, } from "/@/modules/store"
import { aliOSS } from "/@/utils"
import { closeAllSyncDialogs } from "/@/modules/sync-control/common"
import { getCurrentScope } from "@sentry/electron/main"

export function setupUserIpc(ipcMain: IPCMainInstance) {

  /** 登录成功后，保存用户信息 */
  ipcMain.on('user:setUserInfo', async (event, userInfo) => {
    store.token = userInfo.token
    store.userId = userInfo.userId
    store.hasLoggedIn = true
    store.visitorId = ''
    store.userInfo = {
      username: userInfo.userName,
      email: userInfo.email,
    }

    const scope = getCurrentScope();
    scope.setUser({
      id: userInfo.userId,
      email: userInfo.email,
      username: userInfo.userName,
    });
    scope.setTag('process', 'main')

    store.workspaceId = userInfo.workspaceId
    browserManager.reportWindowOpenStatus()
    store.lastLoginTime = Date.now()
    // aliOSS.init()
    // 重新获取用户配置
    await fetchUserConfig()
    openAPIServer.start()
  })

  /** 退出登录 */
  ipcMain.on('user:logout', (event,) => {
    closeAllSyncDialogs()
    browserManager.closeAll().finally(() => {
      store.token = ''
      Reflect.deleteProperty(store, 'userId')
    })
    openAPIServer.stop()
  })

  /** 切换空间时设置当前空间 ID  */
  ipcMain.on('user:setWorkspaceId', (event, workspaceId) => {
    store.workspaceId = workspaceId
  })

  /** 设置所有空间 ID */
  ipcMain.on('user:setAllWorkspaceId', (event, workspaceIds) => {
    store.allWorkspaceId = workspaceIds
  })

  /** 用户上传头像 */
  ipcMain.on('user:uploadAvatar', async (event, avatarPath) => {
    const userId = store.userId
    const extname = path.extname(avatarPath)
    console.log('上传头像', userId, avatarPath, extname)
    const { url } = await aliOSS.put(`/groupdata/useravatar/${userId}/${userId}${extname}`, avatarPath)
    return url
  })
}
