import type { IPCMainInstance } from '/@/modules/ipc/types'
import { getCurrentScope } from '@sentry/electron/main'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
// import { getGatewayConfig } from '/@/api/getGatewayConfig'
import { syncAutoStart } from '/@/modules/app/auto-start'
import { browserManager } from '/@/modules/browser'
import { initDictCache } from '/@/modules/dict'
import { openAPIServer } from '/@/modules/openapi'
import { fetchUserConfig, store } from '/@/modules/store'
import { closeAllSyncDialogs } from '/@/modules/sync-control/common'
import { aliOSS, uploadOssFile } from '/@/utils'

export function setupUserIpc(ipcMain: IPCMainInstance) {
  /** 登录成功后，保存用户信息 */
  ipcMain.on('user:setUserInfo', async (event, userInfo) => {
    store.token = userInfo.token
    store.userId = userInfo.userId
    store.lastUserId = userInfo.lastUserId
    store.hasLoggedIn = true
    store.visitorId = ''
    store.userInfo = {
      username: userInfo.userName,
      email: userInfo.email,
    }

    // if (userInfo.userId) {
    //   getGatewayConfig()
    // }

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
  ipcMain.on('user:logout', async () => {
    closeAllSyncDialogs()
    openAPIServer.stop()
    await browserManager.closeAll({ ensureServerSync: true, syncProgressReason: 'logout' }).finally(() => {
      store.token = ''
      Reflect.deleteProperty(store, 'userId')
    })
  })

  /** 切换空间时设置当前空间 ID；workspaceType 为可选第二参（旧客户端忽略） */
  ipcMain.on('user:setWorkspaceId', (event, workspaceId, workspaceType?: number) => {
    store.workspaceId = workspaceId
    if (workspaceType !== undefined)
      store.workspaceType = workspaceType
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

  /** 用户上传评价图片 */
  ipcMain.on('user:uploadReviewImage', async (event, reviewImagePath) => {
    const userId = store.userId
    const uuid = randomUUID()
    const extname = path.extname(reviewImagePath)
    const { url } = await aliOSS.put(`/groupdata/useravatar/${userId}/${userId}_review_${uuid}${extname}`, reviewImagePath)
    return url
  })

  /** 通用 OSS 文件上传（渲染进程传入完整 objectKey） */
  ipcMain.on('user:uploadOssFile', async (event, payload: { localPath: string, objectKey: string }) => {
    return uploadOssFile(payload)
  })
}
