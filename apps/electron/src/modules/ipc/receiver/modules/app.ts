import type { IPCMainInstance } from '/@/modules/ipc/types'
import { compare } from 'compare-versions'
import { app, BrowserWindow, nativeTheme, screen, shell } from 'electron'
import { appConfig } from '/@/constants'
import { isPackaged } from '/@/constants/common'
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

  /**
   * 获取功能开关
   * scriptRecording：是否启用自动化脚本库与录制入口，由主进程 env ENABLE_SCRIPT_RECORDING=yes 开启
   */
  ipcMain.on('app:getFeatureFlags', (event) => {
    return {
      scriptRecording: process.env.ENABLE_SCRIPT_RECORDING === 'yes',
    }
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

  /** 获取新功能提示 */
  ipcMain.on('app:getNewFeatureTips', async (event) => {
    console.log('showNewFeatureTips', store.showNewFeatureTips)
    if (!store.showNewFeatureTips) {
      return []
    }

    {
      const { version } = appUpdater.getUpdateMessageData()
      // return newFeatureTips?.[store.language] || []
      if (!version) {
        await appUpdater.init()
      }
    }

    const { version, newFeatureTips } = appUpdater.getUpdateMessageData()
    if (version && compare(app.getVersion(), version, '>=')) {
      return newFeatureTips?.[store.language]?.[0]?.content ? newFeatureTips?.[store.language] : []
    }

    return []
  })

  /** 获取最后一次跟新特性 */
  ipcMain.on('app:getLastUpdateFeature', () => {
    return appUpdater.getLastUpdateFeature()
  })

  /** 用户已读新功能提示 */
  ipcMain.on('app:hideNewFeatureTips', (event) => {
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
