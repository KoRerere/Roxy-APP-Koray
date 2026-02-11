import type { IPCMainInstance } from '/@/modules/ipc/types'
import { compare } from 'compare-versions'
import { app, BrowserWindow, nativeTheme, screen, shell } from 'electron'
import { appConfig } from '/@/constants'
import { isPackaged } from '/@/constants/common'
import { getMainWindow } from '/@/modules/app/mainWindow'
import { proxyManager } from '/@/modules/app/proxy-manager'
import { cancelQuit, confirmQuit } from '/@/modules/app/utils'
import { coreManager } from '/@/modules/browser'
import { startMoveWindow, stopMoveWindow } from '/@/modules/ipc/utils'
import { openAPIServer } from '/@/modules/openapi'
import { setSystemProxy } from '/@/modules/roxynet'
import { fetchUserConfig, setUserConfig, store } from '/@/modules/store'
import { appUpdater } from '/@/modules/updater'
import { webUpdater } from '/@/modules/updater/webUpdater'
import { fileExists, getDiskInfoByPath, getFolderSize, getMacAddress } from '/@/utils'

export function setupAppIpc(ipcMain: IPCMainInstance) {
  /** 获取应用版本号 */
  ipcMain.on('app:getAppVersion', (event) => {
    return app.getVersion()
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
  ipcMain.on('app:saveSoftConfig', (event, config) => {
    const originAutoUpdateKernel = store.autoUpdateKernel
    const originSystemProxySwitch = store.systemProxySwitch
    const originV2raySwitch = store.v2raySwitch
    setUserConfig(config)

    // 如果自动更新内核设置变了，则重新检查内核更新
    if (store.autoUpdateKernel !== originAutoUpdateKernel) {
      coreManager.autoDownloadCore()
    }

    if (store.systemProxySwitch !== originSystemProxySwitch) {
      if (store.systemProxySwitch) {
        // 重新设置系统代理
        setSystemProxy()
      }
      else {
        // 这里不需要关闭 roxynet，因为关闭 roxynet 会导致已打开的窗口的系统代理失效
        // stopRoxynet()
      }
    }
    else if (store.v2raySwitch !== originV2raySwitch) {
      // 重新设置系统代理
      setSystemProxy()
    }
  })

  /** 获取软件设置 */
  ipcMain.on('app:getSoftConfig', (event) => {
    return { ...store }
  })

  /** 重新拉起远程软件设置 */
  ipcMain.on('app:fetchSoftConfig', () => {
    console.log('Remote system configuration changed, fetching remote config')
    fetchUserConfig()
  })

  /** 设置窗口是否忽略鼠标事件 */
  ipcMain.on('app:set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    console.log('receiveMouseEvents', win?.id, ignore, options)
    win?.setIgnoreMouseEvents(ignore, options)
  })

  /** 重新获取更新信息，如：APP、内核等版本升级信息 */
  ipcMain.on('app:reGetUpdateInfo', (event, type) => {
    if (type === 'app') {
      return appUpdater.init()
    }
    else if (type === 'kernel') {
      return coreManager.fetchAvailableCoreList()
    }
  })

  /** APP 检查更新 */
  ipcMain.on('app:checkForUpdates', (event) => {
    return appUpdater.checkForUpdates()
  })

  /** WEB 检查更新 */
  ipcMain.on('app:checkWebForUpdates', (event) => {
    return webUpdater.checkForUpdates()
  })

  /** 检查是否有更新 */
  ipcMain.on('app:hasUpdate', (event) => {
    return appUpdater.hasUpdate()
  })

  /** 安装更新 */
  ipcMain.on('app:quitAndInstall', async (event, info) => {
    if (info.type === 'app') {
      appUpdater.upgradeNow()
    }
    else if (info.type === 'web') {
      await webUpdater.upgradeNow()
    }
  })

  /** 获取所有可用的内核列表 */
  ipcMain.on('app:getCoreList', (event) => {
    return coreManager.getCoreList()
  })

  /** 下载指定的内核 */
  ipcMain.on('app:download-chrome-core', (event, coreVersion) => {
    return coreManager.getCoreManager('chrome').downloadCore({ coreVersion })
  })

  /** 删除指定内核 */
  ipcMain.on('app:delete-chrome-core', (event, coreVersion) => {
    return coreManager.getCoreManager('chrome').deleteCore(coreVersion)
  })

  /** 获取本机 mac address */
  ipcMain.on('app:getMacAddress', (event) => {
    return getMacAddress()
  })

  /** 获取浏览器缓存所在磁盘 */
  ipcMain.on('app:getRoxyCacheDiskInfo', async () => {
    await fileExists(appConfig.browserCacheRootDir, true)
    return getDiskInfoByPath(appConfig.browserCacheRootDir)
  })

  /** 获取浏览器缓存文件夹大小 */
  ipcMain.on('app:getRoxyCacheSize', () => {
    return getFolderSize(appConfig.browserCacheRootDir)
  })

  /** 显示 RoxyBrowser 缓存所在目录 */
  ipcMain.on('app:showCacheDir', (event) => {
    shell.openPath(appConfig.browserCacheRootDir)
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

    win!.setContentSize(finalWidth, finalHeight, true) // true = 带动画（Windows11 有效果）
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

  /** 卸载反馈已提交 */
  ipcMain.on('app:uninstall-feedback-submitted', async (event, payload: { reasons: string[], feedback: string }) => {
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
}
