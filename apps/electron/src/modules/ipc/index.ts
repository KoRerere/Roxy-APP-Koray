import type { MainMessage, MainMessageResult, RenderMessage } from '@roxy/electron-preload'
import { IPCMain } from '@roxy/electron-preload/main'
import { dialog, shell } from 'electron'
import crypto from 'node:crypto'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'
import { appConfig, mediaProtocolName } from '/@/constants'
import { browserManager, chromeCoreManager } from '/@/modules/browser'
import { extensionManager } from '/@/modules/extension'
import { store } from '/@/modules/store'
import { appUpdater } from '/@/modules/updater'
import { aliOSS, getMacAddress, getSystemProxy, proxyDetection, tryRefreshUrl } from '/@/utils'

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
ipcMain.on('proxy:detect', (winItemInfo) => {
  return proxyDetection(winItemInfo)
})

/** 根据用户设置，检测本地网络/系统代理 */
ipcMain.on('proxy:detectNetwork', async () => {
  const { systemProxySwitch } = store
  if (systemProxySwitch) {
    const systemProxy = await getSystemProxy()
    console.log('systemProxy', systemProxy)
    const [host, port] = systemProxy.split(':')
    return proxyDetection({ host, port, protocol: 'HTTP' })
  }
  else {
    return proxyDetection({})
  }
})

/** 获取系统代理 */
ipcMain.on('proxy:getSystemProxy', () => {
  return getSystemProxy()
})

/** 代理 => 刷新 URL */
ipcMain.on('proxy:refreshUrl', (refreshUrl) => {
  return tryRefreshUrl(refreshUrl)
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
  store.token = userInfo.token
  store.userId = userInfo.userId
  aliOSS.init()
})

/** 切换空间时设置当前空间 ID  */
ipcMain.on('user:setWorkspaceId', (workspaceId) => {
  store.workspaceId = workspaceId
})

/** 用户上传头像 */
ipcMain.on('user:uploadAvatar', async (avatarPath) => {
  const userId = store.userId
  const extname = path.extname(avatarPath)
  console.log('上传头像', userId, avatarPath, extname)
  const { url } = await aliOSS.put(`/groupdata/useravatar/${userId}/${userId}${extname}`, avatarPath)
  return url
})

/** 保存软件设置 */
ipcMain.on('app:saveSoftConfig', (config) => {
  // @ts-expect-error 后端字段不是一个枚举
  store.closeSoft = config.closeSoft
  store.systemProxySwitch = config.systemProxySwitch
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

/** 选择文件 */
ipcMain.on('dialog:selectFile', async (filters) => {
  try {
    const { filePaths } = await dialog.showOpenDialog({ properties: ['openFile'], filters })
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

/** 生成 api key */
ipcMain.on('base:apikey', () => {
  const str = `${Date.now()}`
  return Promise.resolve(crypto.createHash('md5').update(str, 'utf8').digest('hex'))
})

/** 将本地绝对路径转为自定义媒体协议路径 */
ipcMain.on('util:toMediaPath', (pathname) => {
  return url.format({
    protocol: mediaProtocolName,
    slashes: true,
    pathname,
  })
})

/** 删除工作空间 */
ipcMain.on('util:removeWorkspace', (workspaceId) => {
  return rm(path.join(appConfig.browserCacheRootDir, String(workspaceId)), { recursive: true, force: true })
})

/** 删除项目 */
ipcMain.on('util:removeProject', ({ workspaceId, projectId }) => {
  return rm(path.join(appConfig.browserCacheRootDir, String(workspaceId), String(projectId)), { recursive: true, force: true })
})
