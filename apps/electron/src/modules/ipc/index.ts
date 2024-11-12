import type { MainMessage, MainMessageResult, RenderMessage } from '@roxy/electron-preload'
import type { Config } from 'electron'
import { IPCMain } from '@roxy/electron-preload/main'
import { app, dialog, shell } from 'electron'
import crypto from 'node:crypto'
import path from 'node:path'
import url from 'node:url'
import { getPortPromise } from 'portfinder'
import { API } from '/@/api'
import { getGatewayConfig } from '/@/api/getGatewayConfig'
import { appConfig, mediaProtocolName } from '/@/constants'
import { getMainWindow } from '/@/modules/app/mainWindow'
import { browserManager, chromeCoreManager } from '/@/modules/browser'
import { extensionManager } from '/@/modules/extension'
import { openAPIServer } from '/@/modules/openapi'
import { delLuminetProxy, startLuminet, stopLuminet } from '/@/modules/roxynet'
import { fetchUserConfig, store } from '/@/modules/store'
import { appUpdater } from '/@/modules/updater'
import { aliOSS, decryptAESGCM, detectNetwork, encryptAESGCM, genRandomFonts, getMacAddress, getSystemProxy, proxyDetection, setWebReady, tryRefreshUrl } from '/@/utils'
import { genRandomFingerprint } from '/@/utils/randomFingerprint'

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

/** 删除 luminet 代理 */
ipcMain.on('proxy:delLuminetProxy', (dirId) => {
  return delLuminetProxy(dirId)
})

/** 根据用户设置，检测本地网络/系统代理 */
ipcMain.on('proxy:detectNetwork', async (type?: 'local' | 'system') => {
  return detectNetwork(type)
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
ipcMain.on('browser:batchRemove', (winItems) => {
  return browserManager.batchDelete(winItems)
})

/** 获取所有已打开的窗口 */
ipcMain.on('browser:getOpenedBrowser', () => {
  return Array.from(browserManager.openedBrowserMap.values()).map(browserItem => browserItem.lastMessage!)
})

/**
 * 清除浏览器缓存
 * @param type 清除类型
 * excludeExtension 清除本地缓存，保留插件
 * all 清除本地缓存
 */
ipcMain.on('browser:clearCache', async (payload) => {
  const { clearType, dirId } = payload
  if (clearType === 'all') {
    // 清除本地缓存
    console.log('清除本地缓存', dirId)
    await browserManager.removeLocalData(dirId)
  }
  else if (clearType === 'partial') {
    // 清除本地缓存，保留插件
    console.log('清除本地缓存，保留插件', dirId)
    await browserManager.removeLocalDataExcludeExtension(dirId)
  }
})

/** 登录成功后，保存用户信息 */
ipcMain.on('user:setUserInfo', (userInfo) => {
  store.token = userInfo.token
  store.userId = userInfo.userId
  // 重新获取用户配置
  fetchUserConfig()
  openAPIServer.start()
  // aliOSS.init()
})

/** 登录成功后，保存用户信息 */
ipcMain.on('user:logout', () => {
  browserManager.closeAll().finally(() => {
    store.token = ''
    Reflect.deleteProperty(store, 'userId')
  })
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

/** 获取应用版本号 */
ipcMain.on('app:getAppVersion', () => {
  return app.getVersion()
})

/** openapi 端口或开关变的时候，需要重启服务 */
ipcMain.on('app:restartAPIServer', () => {
  console.log('app:restartAPIServer', 'openapi 端口或开关发生变化，正在重启服务...')
  openAPIServer.start()
})

/** 保存软件设置 */
ipcMain.on('app:saveSoftConfig', (config) => {
  const originSystemProxySwitch = store.systemProxySwitch
  const originV2raySwitch = store.v2raySwitch
  Object.keys(config).forEach((key) => {
    if (Reflect.has(store, key)) {
      Reflect.set(store, key, Reflect.get(config, key))
    }
  })

  if (store.systemProxySwitch !== originSystemProxySwitch) {
    if (store.systemProxySwitch) {
      // 重新设置系统代理
      startLuminet()
    }
    else {
      // 这里不需要关闭 luminet，因为关闭 luminet 会导致已打开的窗口的系统代理失效
      stopLuminet()
    }
  }
  else if (store.v2raySwitch !== originV2raySwitch) {
    // 重新设置系统代理
    startLuminet()
  }
})

/** 获取软件设置 */
ipcMain.on('app:getSoftConfig', () => {
  return { ...store }
})

/** 选择文件夹 */
ipcMain.on('dialog:selectDir', async (defaultPath?: string) => {
  try {
    const { filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath,
    })
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
ipcMain.on('app:checkForUpdates', () => {
  return appUpdater.checkForUpdates()
})

/** 检查是否有更新 */
ipcMain.on('app:hasUpdate', () => {
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

/** 开启系统代理 */
ipcMain.on('app:setProxy', async (payload: Config) => {
  const mainWindow = getMainWindow()!
  console.log(payload)
  await mainWindow.webContents.session.setProxy({
    ...payload,
    proxyBypassRules: 'localhost',
  })
  console.log('代理设置完毕')
})
/** 关闭系统代理 */
ipcMain.on('app:removeProxy', () => {
  const mainWindow = getMainWindow()!
  mainWindow.webContents.session.setProxy({})
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
ipcMain.on('util:genApiKey', () => {
  return crypto.createHash('md5').update(String(Date.now()), 'utf8').digest('hex')
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
ipcMain.on('util:removeWorkspace', async (workspaceId) => {
  const result = await API.window.userGetWindowInfoV2List({ page_index: 1, page_size: 1000 }, { headers: { workspaceId } })

  if (result.code === 0) {
    const promiseArr = result.data.rows.map(winInfo => browserManager.removeLocalData(winInfo.dirId!))
    Promise.all(promiseArr).then((data) => {
      console.log('删除工作空间成功', data)
    }).catch((error) => {
      console.error('删除工作空间失败', error)
    })
  }
})

/** 删除项目 */
ipcMain.on('util:removeProject', async ({ workspaceId, projectId }) => {
  const result = await API.window.userGetWindowInfoV2List({ projectIds: projectId }, { headers: { workspaceId } })

  if (result.code === 0) {
    const promiseArr = result.data.rows.map(winInfo => browserManager.removeLocalData(winInfo.dirId!))
    Promise.all(promiseArr).then((data) => {
      console.log('删除项目成功', data)
    }).catch((error) => {
      console.error('删除项目失败', error)
    })
  }
})

/** 随机生成字体 */
ipcMain.on('util:genRandomFonts', () => {
  return genRandomFonts()
})

/** 生成随机指纹 */
ipcMain.on('util:genRandomFingerprint', (payload, count = 1) => {
  return genRandomFingerprint(payload, count)
})

/** AES-GCM 加密 */
ipcMain.on('util:encryptAESGCM', (msg) => {
  return encryptAESGCM(msg)
})

/** AES-GCM 解密 */
ipcMain.on('util:decryptAESGCM', (msg) => {
  return decryptAESGCM(msg)
})

/** 获取网关配置 */
ipcMain.on('util:getGatewayConfig', () => {
  return getGatewayConfig()
})

/** 检查端口是否被占用 */
ipcMain.on('util:checkPort', async (port: number) => {
  console.log('util:checkPort', port)
  console.log('store.apiPort', store.apiPort)
  if (port === store.apiPort) {
    return port
  }

  try {
    const availablePort = await getPortPromise({ port })
    return availablePort
  }
  catch (error) {
    console.error('Error checking port:', error)
    return port
  }
})

/** 前端已准备就绪 */
ipcMain.on('web:ready', () => {
  console.log('web:ready')
  setWebReady()
})
