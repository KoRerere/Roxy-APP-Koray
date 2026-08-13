import type { IPCMainInstance } from '/@/modules/ipc/types'
import { copyFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compare } from 'compare-versions'
import { app, BrowserWindow, dialog, nativeTheme, screen, shell } from 'electron'
import { appConfig } from '/@/constants'
import { getMainWindow } from '/@/modules/app/mainWindow'
import { proxyManager } from '/@/modules/app/proxy-manager'
import { refreshTrayContextMenu } from '/@/modules/app/tray'
import { cancelQuit, confirmQuit } from '/@/modules/app/utils'
import { coreManager } from '/@/modules/browser'
import { CoreType } from '/@/modules/browser/browser-manager/adapter'
import { startMoveWindow, stopMoveWindow } from '/@/modules/ipc/utils'
import { openAPIServer } from '/@/modules/openapi'
import { setSystemProxy, startRoxynet } from '/@/modules/roxynet'
import { cancelRestoreLastWindowOpenStatus, fetchUserConfig, getRestoreLastWindowOpenStatusOnException, restoreLastWindowOpenStatusResolver, setUserConfig, store } from '/@/modules/store'
import { checkRestoreClientNetworkChanged } from '/@/modules/store/restoreClientNetwork'
import { getNetworkMode } from '/@/modules/store/networkMode'
import { appUpdater, confirmMacAppOwnershipFix, getMacAppOwnershipFixStatus } from '/@/modules/updater'
import { ensureBrowserCacheRootDir, fileExists, getDiskInfoByPath, getFolderSize, getMacAddress } from '/@/utils'
import { getProdWebDomain } from '/@/utils/getProdWebDomain'

let appIdleState = false

/** 获取 APP 当前是否为空闲状态 */
export function getAppIdleState() {
  return appIdleState
}

export function setupAppIpc(ipcMain: IPCMainInstance) {
  /** 获取应用版本号 */
  ipcMain.on('app:getAppVersion', (event) => {
    return app.getVersion()
  })

  /** macOS：查询 .app 属主修复状态，供渲染进程加载完成后决定是否弹窗 / 提示成功 */
  ipcMain.on('app:getMacOwnershipFixStatus', () => {
    return getMacAppOwnershipFixStatus()
  })

  /** macOS：用户确认后执行 copy-replace 修复并自动重启 */
  ipcMain.on('app:confirmMacOwnershipFix', () => {
    return confirmMacAppOwnershipFix()
  })

  /** 设置系统主题 */
  ipcMain.on('app:setSystemTheme', (event, theme) => {
    nativeTheme.themeSource = theme
  })

  /** openapi 端口或开关变的时候，需要重启服务 */
  ipcMain.on('app:restartAPIServer', (event) => {
    console.log(
      'app:restartAPIServer',
      'OpenAPI port or switch changed, restarting service...',
    )
    return openAPIServer.start()
  })

  /** 保存软件设置 */
  ipcMain.on('app:saveSoftConfig', async (event, config) => {
    const originAutoUpdateKernel = store.autoUpdateKernel
    const originNetworkMode = store.networkMode
    const originV2raySwitch = store.v2raySwitch
    const kernelProxyKeys = ['proxyProtocol', 'proxyHost', 'proxyPort', 'proxyUsername', 'proxyPassword'] as const
    setUserConfig(config)

    const appNetworkKeys = ['appNetwork', ...kernelProxyKeys] as const
    if (appNetworkKeys.some(k => k in config)) {
      await proxyManager.applyAppNetwork()
      refreshTrayContextMenu()
    }

    // 如果自动更新内核设置变了，则重新检查内核更新
    if (store.autoUpdateKernel !== originAutoUpdateKernel) {
      coreManager.autoDownloadCore()
    }

    const networkMode = getNetworkMode()
    const kernelProxyChanged = kernelProxyKeys.some(k => k in config)
    const v2rayChangedForSystem = store.v2raySwitch !== originV2raySwitch && networkMode === 'system'
    const shouldRefreshRoxynetUpstream
      = (store.networkMode !== originNetworkMode && (networkMode === 'system' || networkMode === 'custom'))
        || (kernelProxyChanged && networkMode === 'custom')
        || v2rayChangedForSystem

    if (shouldRefreshRoxynetUpstream) {
      await startRoxynet().catch(() => { })
      await setSystemProxy()
    }
  })

  /** 获取软件设置 */
  ipcMain.on('app:getSoftConfig', (event) => {
    return { ...store }
  })

  /** 重新拉起远程软件设置 */
  ipcMain.on('app:fetchSoftConfig', () => {
    console.log('Remote system configuration changed, fetching remote config')
    return fetchUserConfig()
  })

  /** 设置窗口是否忽略鼠标事件 */
  ipcMain.on('app:set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    console.log('receiveMouseEvents', win?.id, ignore, options)
    win?.setIgnoreMouseEvents(ignore, options)
  })

  /** 重新获取更新信息，如：APP、内核等版本升级信息 */
  ipcMain.on('app:reGetUpdateInfo', (event, type, coreType: CoreType = CoreType.Chrome) => {
    if (type === 'app') {
      return appUpdater.init()
    }
    else if (type === 'kernel') {
      return coreManager.getCoreManager(coreType).fetchAvailableCoreList()
    }
  })

  /** APP 检查更新 */
  ipcMain.on('app:checkForUpdates', (event) => {
    return appUpdater.checkForUpdates()
  })

  /** 检查是否有更新 */
  ipcMain.on('app:hasUpdate', (event) => {
    return appUpdater.hasUpdate()
  })

  /** 安装更新 */
  ipcMain.on('app:quitAndInstall', async (event, info) => {
    if (info.type === 'app') {
      store.needRestoreWindow = true
      appUpdater.upgradeNow()
    }
  })

  /** 获取所有可用的内核列表 */
  ipcMain.on('app:getCoreList', (event) => {
    return coreManager.getCoreList()
  })

  /** 下载指定的内核 */
  ipcMain.on('app:download-chrome-core', (event, coreVersion, coreType: CoreType = CoreType.Chrome) => {
    return coreManager.getCoreManager(coreType).downloadCore({ coreVersion })
  })

  /** 取消下载指定的内核 */
  ipcMain.on('app:cancel-download-chrome-core', (event, coreVersion, coreType: CoreType = CoreType.Chrome) => {
    return coreManager.getCoreManager(coreType).cancelDownloadCore(coreVersion).catch((error) => {
      console.error('app:cancel-download-chrome-core error', error)
    })
  })

  /** 删除指定内核 */
  ipcMain.on('app:delete-chrome-core', (event, coreVersion, coreType: CoreType = CoreType.Chrome) => {
    return coreManager.getCoreManager(coreType).deleteCore(coreVersion)
  })

  /** 获取本机 mac address */
  ipcMain.on('app:getMacAddress', (event) => {
    return getMacAddress()
  })

  /** 确保浏览器缓存根目录存在（选路径时 recursive 创建整条路径） */
  ipcMain.on('app:ensureBrowserCacheRootDir', async (_event, dirPath: string) => {
    return ensureBrowserCacheRootDir(dirPath, { recursive: true })
  })

  /** 获取浏览器缓存所在磁盘 */
  ipcMain.on('app:getRoxyCacheDiskInfo', async () => {
    await fileExists(store.browserCacheRootDir, true)
    return getDiskInfoByPath(store.browserCacheRootDir)
  })

  /** 获取浏览器缓存文件夹大小 */
  ipcMain.on('app:getRoxyCacheSize', () => {
    return getFolderSize(store.browserCacheRootDir)
  })

  /** 显示 RoxyBrowser 缓存所在目录 */
  ipcMain.on('app:showCacheDir', (event) => {
    shell.openPath(store.browserCacheRootDir)
  })

  /** 显示系统日志所在目录 */
  ipcMain.on('app:showLogDir', (event) => {
    shell.openPath(appConfig.logsDir)
  })
  /** 程序化显示和隐藏红绿灯 */
  ipcMain.on('app:showHideTrafficLight', (event, show) => {
    getMainWindow()?.setWindowButtonVisibility?.(show)
  })

  /** 当前 APP 窗口是否是主窗口 */
  ipcMain.on('app:isMainWindow', (event) => {
    return (
      getMainWindow()?.id === BrowserWindow.fromWebContents(event.sender)?.id
    )
  })

  /** 显示当前网页所在的窗口 */
  ipcMain.on('app:showCurrentWebviewWindow', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.show()
  })

  /** 开始移动窗口 */
  ipcMain.on('app:startMoveWindow', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win && startMoveWindow(win)
  })

  /** 停止移动窗口 */
  ipcMain.on('app:stopMoveWindow', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win && stopMoveWindow(win)
  })

  /** 获取系统 GPU 信息 */
  ipcMain.on('app:getGPUFeatureStatus', (event) => {
    return app.getGPUFeatureStatus()
  })

  /** 动态设置窗口大小 */
  ipcMain.on('app:resizeWindow', (event, payload) => {
    const win = BrowserWindow.fromWebContents(event.sender)

    if (!win) {
      return
    }

    const [width, height] = win.getContentSize()

    // 当前窗口所在屏幕的可用工作区高度（不含任务栏）
    const display = screen.getDisplayMatching(win.getBounds())
    const { width: maxWidth, height: maxHeight } = display.workAreaSize

    const minHeight = 200
    const minWidth = 200
    const finalHeight = Math.min(Math.max(payload.height || height, minHeight), maxHeight)
    const finalWidth = Math.min(Math.max(payload.width || width, minWidth), maxWidth)
    const shouldCenter = Boolean(payload.center)

    if (shouldCenter) {
      // 用 setContentBounds 一次性设置内容区位置与尺寸（DIP），高 DPI 缩放下避免外框/阴影导致偏移
      const { x, y, width: workWidth, height: workHeight } = display.workArea
      const posX = Math.round(x + (workWidth - finalWidth) / 2)
      const posY = Math.round(y + (workHeight - finalHeight) / 2)
      win.setContentBounds({
        x: posX,
        y: posY,
        width: finalWidth,
        height: finalHeight,
      }, false)
    }
    else {
      win.setContentSize(finalWidth, finalHeight, true)
    }
  })

  /**
   * 获取新功能提示（登录后按当前 workspaceId 现拉）
   * - 版本门禁：仍走 getAppUpgradeCreate
   * - tips 内容：走 userGetAppFeatureTipsCreate
   */
  ipcMain.on('app:getNewFeatureTips', async () => {
    console.log('showNewFeatureTips', store.showNewFeatureTips)
    if (!store.showNewFeatureTips) {
      return []
    }

    // 登录/空间未就绪：不消费开关，等就绪后再查
    if (!store.token || !store.workspaceId) {
      console.log('[app:getNewFeatureTips] token or workspaceId missing, skip')
      return []
    }

    // 版本信息仍走老接口，仅用于「本地已升级到远端版本」门禁
    const refreshResult = await appUpdater.refreshUpgradePayload().catch((error) => {
      console.error('[app:getNewFeatureTips] refreshUpgradePayload failed', error)
      return null
    })
    // 版本拉取失败：不消费开关，避免瞬时错误挡住后续 tips
    if (!refreshResult || refreshResult.code !== 0 || !refreshResult.data) {
      return []
    }

    let { version } = appUpdater.getUpdateMessageData()
    if (!version) {
      await appUpdater.init()
      ;({ version } = appUpdater.getUpdateMessageData())
    }

    if (!(version && compare(app.getVersion(), version, '>='))) {
      return []
    }

    // tips 走独立接口；失败不消费开关
    const tipsResult = await appUpdater.fetchAppFeatureTips().catch((error) => {
      console.error('[app:getNewFeatureTips] fetchAppFeatureTips failed', error)
      return null
    })
    if (!tipsResult || tipsResult.code !== 0 || !tipsResult.data) {
      return []
    }

    const { newFeatureTips } = tipsResult.data
    const languageTips = newFeatureTips?.[store.language as 'zh-CN' | 'en' | 'ru']
    const tips = languageTips?.[0]?.content ? languageTips : []

    // 当前空间无 tips：消费开关，避免反复请求；切空间也不再弹
    if (!tips.length) {
      store.showNewFeatureTips = false
      return []
    }

    return tips
  })

  /** 获取最后一次跟新特性 */
  ipcMain.on('app:getLastUpdateFeature', () => {
    return appUpdater.getLastUpdateFeature()
  })

  /** 用户已读新功能提示 */
  ipcMain.on('app:hideNewFeatureTips', () => {
    store.showNewFeatureTips = false
  })

  /** 是否显示长时间未登录提示 */
  ipcMain.on('app:isShowLongTimeNotLoginTips', (event) => {
    const isShow = store.showLongTimeNotLoginTips || false
    store.showLongTimeNotLoginTips = false
    return isShow
  })

  /** 设置下次更新时间 */
  ipcMain.on('app:setNextUpdateTime', (event, timestamp) => {
    store.nextUpdateTimestamp = timestamp
  })

  /** 开启系统代理 */
  ipcMain.on('app:setProxy', async (event, payload: any) => {
    console.log(payload)

    // 更新代理管理器配置
    proxyManager.updateConfig({
      proxyRules: payload.proxyRules || '',
      proxyBypassRules: payload.proxyBypassRules || 'localhost',
    })
    await proxyManager.enableDefaultProxy()

    console.log('Proxy configuration completed')
  })

  /** 关闭系统代理 */
  ipcMain.on('app:removeProxy', async (event) => {
    await proxyManager.disableProxy()
  })

  /** 获取系统代理信息 */
  ipcMain.on('app:getSystemProxyInfo', async (event) => {
    return await proxyManager.getSystemProxyInfo()
  })

  /** 测试 web 域名 */
  ipcMain.on('app:testWebDomain', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const prodWebDomain = await getProdWebDomain(true)
    console.log('testWebDomain', prodWebDomain)
    win?.loadURL(prodWebDomain)
  })

  /** 卸载反馈已提交 */
  ipcMain.on('app:uninstall-feedback-submitted', async (event, payload: { reasons: number[], selectedReasons: string[] }) => {
    console.log('Uninstall feedback submitted:', payload)
    confirmQuit()
  })

  /** 跳过卸载反馈 */
  ipcMain.on('app:uninstall-feedback-skipped', async (event) => {
    console.log('Uninstall feedback skipped')
    confirmQuit()
  })

  /** 直接卸载，无需反馈 */
  ipcMain.on('app:uninstall-directly', async (event) => {
    console.log('Uninstall directly')
    confirmQuit()
  })

  /** 打开外部链接 */
  ipcMain.on('app:open-external-url', async (event, url: string) => {
    shell.openExternal(url)
  })

  /** 下载本地文件 */
  ipcMain.on('app:downloadLocalFile', async (event, payload: { filePath: string, fileName?: string }) => {
    if (!payload?.filePath)
      throw new Error('Local file path is required')

    const sourcePath = normalizeLocalFilePath(payload.filePath)
    const sourceStat = await stat(sourcePath)
    if (!sourceStat.isFile())
      throw new Error('Local path is not a file')

    const ownerWindow = BrowserWindow.fromWebContents(event.sender)
    const saveDialogOptions = {
      defaultPath: payload.fileName || path.basename(sourcePath),
    }
    const { canceled, filePath: targetPath } = ownerWindow
      ? await dialog.showSaveDialog(ownerWindow, saveDialogOptions)
      : await dialog.showSaveDialog(saveDialogOptions)

    if (canceled || !targetPath)
      return { canceled: true }

    await copyFile(sourcePath, targetPath)
    return { canceled: false, filePath: targetPath }
  })

  /** 取消卸载 */
  ipcMain.on('app:uninstall-cancelled', async (event) => {
    console.log('Uninstall cancelled by user')
    cancelQuit()
  })

  /** 设置 APP 当前是否为空闲状态 */
  ipcMain.on('app:setIdleState', (event, idle: boolean) => {
    appIdleState = idle
    if (idle) {
      appUpdater.installUpdateWhenIdle()
    }
  })

  /** 恢复窗口函数是否准备好了 */
  ipcMain.on('app:restoreLastWindowOpenStatusReady', (event) => {
    return restoreLastWindowOpenStatusResolver.promise
  })

  /** 检查是否需要恢复窗口 */
  ipcMain.on('app:checkNeedRestoreWindow', (event) => {
    return getRestoreLastWindowOpenStatusOnException() !== null
  })

  /** 恢复窗口前检查客户端网络是否相对上次快照发生变化 */
  ipcMain.on('app:checkRestoreClientNetworkChanged', async () => {
    return checkRestoreClientNetworkChanged()
  })

  /** 恢复窗口 */
  ipcMain.on('app:restoreWindow', async (event) => {
    return getRestoreLastWindowOpenStatusOnException()?.()
  })

  /** 取消恢复窗口 */
  ipcMain.on('app:cancelRestoreWindow', (event) => {
    cancelRestoreLastWindowOpenStatus()
  })
}

function normalizeLocalFilePath(filePath: string) {
  if (!filePath.startsWith('file://'))
    return filePath

  const decodedFilePath = decodeFileUrl(filePath)
  const windowsDrivePath = resolveWindowsDriveFileUrl(decodedFilePath)
  if (windowsDrivePath)
    return windowsDrivePath

  try {
    return fileURLToPath(decodedFilePath)
  }
  catch {
    return filePath
  }
}

function resolveWindowsDriveFileUrl(fileUrl: string) {
  const fileUrlPath = fileUrl.slice('file://'.length)
  if (/^\/[a-z]:[\\/]/i.test(fileUrlPath))
    return fileUrlPath.slice(1)

  if (/^[a-z]:[\\/]/i.test(fileUrlPath))
    return fileUrlPath

  return ''
}

function decodeFileUrl(fileUrl: string) {
  try {
    return decodeURI(fileUrl)
  }
  catch {
    return fileUrl
  }
}
