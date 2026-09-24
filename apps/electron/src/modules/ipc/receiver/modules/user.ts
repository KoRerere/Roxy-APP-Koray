import type { IPCMainInstance } from '/@/modules/ipc/types'
import { getCurrentScope } from '@sentry/electron/main'
import { randomUUID } from 'node:crypto'
import { stat } from 'node:fs/promises'
import path from 'node:path'
// import { getGatewayConfig } from '/@/api/getGatewayConfig'
import { syncAutoStart } from '/@/modules/app/auto-start'
import { getMainWindow } from '/@/modules/app/mainWindow'
import { browserManager } from '/@/modules/browser'
import { initDictCache } from '/@/modules/dict'
import { mcpManager } from '/@/modules/mcp'
import { openAPIServer } from '/@/modules/openapi'
import { workspaceSwitchBridge } from '/@/modules/openapi/workspaceSwitchBridgeInstance'
import { fetchUserConfig, forceSaveConfig, store } from '/@/modules/store'
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
    await openAPIServer.start()
    void mcpManager.startRoxyClawIfEnabled('login', { ensureOpenAPIServer: false })
    console.log('user:setUserInfo', store.autoStart)
    syncAutoStart(Boolean(store.autoStart))
  })

  /** 退出登录 */
  ipcMain.on('user:logout', async () => {
    closeAllSyncDialogs()
    openAPIServer.stop()
    await mcpManager.closeMcpServer({ waitForExit: true })
    await browserManager.closeAll({ ensureServerSync: true, syncProgressReason: 'logout' }).finally(async () => {
      store.token = ''
      store.workspaceId = undefined
      store.workspaceType = undefined
      store.allWorkspaceId = []
      store.sharedWorkspaceList = []
      Reflect.deleteProperty(store, 'userId')
      await forceSaveConfig()
    })
  })

  /** 切换空间时设置当前空间 ID；workspaceType 为可选第二参（旧客户端忽略） */
  ipcMain.on('user:setWorkspaceId', (event, workspaceId, workspaceType?: number) => {
    store.workspaceId = workspaceId
    if (workspaceType !== undefined) {
      store.workspaceType = workspaceType
    }
  })

  ipcMain.on('user:workspace-select-result', (event, result) => {
    console.log('[workspace-select] ipc result received by main', {
      requestId: result.requestId,
      workspaceId: result.workspaceId,
      success: result.success,
      senderId: event.sender.id,
    })
    const mainWindow = getMainWindow()
    if (!mainWindow || event.sender.id !== mainWindow.webContents.id) {
      return
    }
    workspaceSwitchBridge.complete(result)
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

  /** 用户上传空间图片；同一空间固定一个 object，再次上传即覆盖 */
  ipcMain.on('user:uploadWorkspaceImage', async (event, workspaceImagePath, workspaceId) => {
    const extname = path.extname(workspaceImagePath).toLowerCase()
    if (!['.png', '.jpg', '.jpeg', '.bmp'].includes(extname)) {
      throw new Error('Invalid workspace image type')
    }
    const fileStat = await stat(workspaceImagePath)
    if (fileStat.size > 1024 * 1024) {
      throw new Error('Workspace image exceeds 1MB')
    }

    const userId = store.userId
    const targetWorkspaceId = workspaceId ?? store.workspaceId
    const { url } = await aliOSS.put(`/groupdata/useravatar/${userId}/${targetWorkspaceId}${extname}`, workspaceImagePath)
    return url
  })

  /** 通用 OSS 文件上传（渲染进程传入完整 objectKey） */
  ipcMain.on('user:uploadOssFile', async (event, payload: { localPath: string, objectKey: string }) => {
    return uploadOssFile(payload)
  })
}
