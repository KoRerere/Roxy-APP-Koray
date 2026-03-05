import type { IPCMainInstance } from '/@/modules/ipc/types'
import { getCurrentScope } from '@sentry/electron/main'
import path from 'node:path'
import { syncAutoStart } from '/@/modules/app/auto-start'
import { browserManager } from '/@/modules/browser'
import { initDictCache } from '/@/modules/dict'
import { openAPIServer } from '/@/modules/openapi'
import { fetchUserConfig, store } from '/@/modules/store'
import { closeAllSyncDialogs } from '/@/modules/sync-control/common'
import { aliOSS } from '/@/utils'

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

    const scope = getCurrentScope()
    scope.setUser({
      id: userInfo.userId,
      email: userInfo.email,
      username: userInfo.userName,
    })
    scope.setTag('process', 'main')

    store.workspaceId = userInfo.workspaceId
    browserManager.reportWindowOpenStatus()
    store.lastLoginTime = Date.now()
    initDictCache()
    // aliOSS.init()
    // 重新获取用户配置
    await fetchUserConfig()
    openAPIServer.start()
    console.log('user:setUserInfo', store.autoStart)
    syncAutoStart(Boolean(store.autoStart))
  })

  /** 退出登录 */
  ipcMain.on('user:logout', async (event) => {
    closeAllSyncDialogs()
    openAPIServer.stop()
    await browserManager.closeAll().finally(() => {
      store.token = ''
      Reflect.deleteProperty(store, 'userId')
    })
  })

  /** 切换空间时设置当前空间 ID  */
  ipcMain.on('user:setWorkspaceId', (event, workspaceId) => {
    store.workspaceId = workspaceId
  })

  /** 设置所有空间 ID */
  ipcMain.on('user:setAllWorkspaceId', (event, workspaceIds) => {
    store.allWorkspaceId = workspaceIds
  })

  /** 设置公共空间列表 */
  ipcMain.on('user:setSharedWorkspaceList', (event, workspaceList) => {
    store.sharedWorkspaceList = workspaceList
  })

  /** 用户上传头像 */
  ipcMain.on('user:uploadAvatar', async (event, avatarPath) => {
    const userId = store.userId
    const extname = path.extname(avatarPath)
    console.log('Uploading avatar', userId, avatarPath, extname)
    const { url } = await aliOSS.put(`/groupdata/useravatar/${userId}/${userId}${extname}`, avatarPath)
    return url
  })
}
