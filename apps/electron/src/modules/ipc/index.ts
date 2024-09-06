import { IPCMain } from '@roxy/electron-preload/main'
import type { MainMessage, MainMessageResult, RenderMessage } from '@roxy/electron-preload'
import { browserManager, chromeCoreManager } from '/@/modules/browser'
import { aliOSS, getMacAddress, proxyDetection } from '/@/utils'
import { store } from '/@/modules/store'
import { dialog, shell } from 'electron'
import { appUpdater } from '/@/modules/updater'
import { extensionManager } from '/@/modules/extension'
import { appConfig } from '/@/constants'

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
ipcMain.on('app:quitAndInstall', (info) => {
  if (info.type === 'app') {
    appUpdater.upgradeNow()
  }
})

/** 获取所有可用的内核列表 */
ipcMain.on('app:getCoreList', () => {
  return chromeCoreManager.getCoreList()
})

/** 下载指定的内核 */
ipcMain.on('app:download-chrome-core', (coreVersion) => {
  return chromeCoreManager.downloadCore(coreVersion)
})

/** 获取本机 mac address */
ipcMain.on('app:getMacAddress', () => {
  return getMacAddress()
})

/** 显示系统日志所在目录 */
ipcMain.on('app:showLogDir', () => {
  shell.openPath(appConfig.logsDir)
})

/** 下载指定插件 */
ipcMain.on('extension:download', (extensions) => {
  return extensionManager.downloadExtensions(extensions)
})

/** 删除指定插件 */
ipcMain.on('extension:remove', (extIDs: string[]) => {
  return extensionManager.removeExtensions(extIDs)
})

/** 获取并解析用户本地选择的插件信息 */
ipcMain.on('extension:getSelectedExtensionInfo', (selectType: 'dir' | 'file') => {
  return extensionManager.getUserSelectedExtensionInfo(selectType)
})

/** 上传本地插件到 OSS */
ipcMain.on('extension:uploadExtensionToOSS', (payload) => {
  return extensionManager.uploadExtensionToOSS(payload)
})

/** 检测本地插件是否有可用的更新，返回结果是插件ID字符串数组，表示本地哪些插件时可以更新的 */
ipcMain.on('extension:checkLocalExtensionUpdate', (checkList) => {
  return extensionManager.checkLocalExtensionUpdate(checkList)
})

/** 获取本地已安装的插件 */
ipcMain.on('extension:getInstalledExtensions', () => {
  return extensionManager.getInstalledExtensions()
})
