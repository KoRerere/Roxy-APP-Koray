import { IPCMain } from '@roxy/electron-preload/main'
import type { MainMessage, MainMessageResult, RenderMessage } from '@roxy/electron-preload'
import { browserManager } from '/@/modules/browser'
import { aliOSS, proxyDetection } from '/@/utils'
import { store } from '/@/modules/store'
import { dialog } from 'electron'
import { appUpdater } from '/@/modules/updater'

export const ipcMain = new IPCMain<RenderMessage, MainMessage>()

/** 成功的消息体 */
export function successDataWrapper<T>(data: T, message = 'success'): MainMessageResult<T> {
  return {
    code: 0,
    data,
    message,
  }
}

/** 错误的信息体 */
export function errorDataWrapper(message = 'error', data?: any, error?: any): MainMessageResult {
  return {
    code: 1,
    data,
    message,
    error,
  }
}

/** 代理检测 */
ipcMain.on('proxy:detection', (winItemInfo) => {
  return proxyDetection(winItemInfo)
})

/** 批量启动浏览器 */
ipcMain.on('browser:batchLaunch', (winItemList) => {
  return browserManager.batchLaunch(winItemList)
})

/** 批量关闭浏览器 */
ipcMain.on('browser:batchClose', (dirIds: string[]) => {
  return browserManager.batchClose(dirIds)
})

/** 批量重启浏览器 */
ipcMain.on('browser:batchRelaunch', (winItemList) => {
  return browserManager.batchReLaunch(winItemList)
})

/** 批量删除本地浏览器 */
ipcMain.on('browser:batchRemove', (dirIds) => {
  return browserManager.batchDelete(dirIds)
})

/** 登录成功后，保存用户信息 */
ipcMain.on('user:setUserInfo', (userInfo) => {
  store.userInfo = userInfo
  aliOSS.init()
})

/** 保存软件设置 */
ipcMain.on('app:saveSoftConfig', (config) => {
  // @ts-expect-error 后端字段不是一个枚举
  store.closeSoft = config.closeSoft
  store.memoryLimit = Number(config.memoryLimit) ? Number(config.memoryLimit) : 95
  store.browserCacheRootDir = config.cacheDir
})

/** 选择文件夹 */
ipcMain.on('dialog:selectDir', async () => {
  try {
    const { filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return filePaths[0]
  }
  catch (error) {
    console.log(error)
    return ''
  }
})

/** 检查更新 */
ipcMain.on('app:checkUpdate', () => {
  return appUpdater.hasUpdate()
})

/** 安装更新 */
ipcMain.on('app:install-update', (info) => {
  if (info.type === 'app') {
    appUpdater.upgradeNow()
  }
})
