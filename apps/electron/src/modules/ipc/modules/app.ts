
import { startRoxynet } from "/@/modules/roxynet"
import { IPCMainInstance } from "/@/modules/ipc/types"
import { app, BrowserWindow, Config, shell, screen } from "electron"
import { fetchUserConfig, store } from "/@/modules/store"
import { openAPIServer } from "/@/modules/openapi"
import { appUpdater } from "/@/modules/updater"
import { chromeCoreManager } from "/@/modules/browser"
import { webUpdater } from "/@/modules/updater/webUpdater"
import { getMacAddress } from "/@/utils"
import { appConfig } from "/@/constants"
import { getMainWindow } from "/@/modules/app/mainWindow"
import { startMoveWindow, stopMoveWindow } from "/@/modules/ipc/utils"

export function setupAppIpc(ipcMain: IPCMainInstance) {

  /** 隐藏商业化弹窗 */
  ipcMain.on('app:hideBusinessPopup', (event,) => {
    store.isShowBusinessDialog = false
  })

  /** 获取应用版本号 */
  ipcMain.on('app:getAppVersion', (event,) => {
    return app.getVersion()
  })

  /** openapi 端口或开关变的时候，需要重启服务 */
  ipcMain.on('app:restartAPIServer', (event,) => {
    console.log('app:restartAPIServer', 'openapi 端口或开关发生变化，正在重启服务...')
    openAPIServer.start()
  })

  /** 保存软件设置 */
  ipcMain.on('app:saveSoftConfig', (event, config) => {
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
        startRoxynet()
      }
      else {
        // 这里不需要关闭 roxynet，因为关闭 roxynet 会导致已打开的窗口的系统代理失效
        // stopRoxynet()
      }
    }
    else if (store.v2raySwitch !== originV2raySwitch) {
      // 重新设置系统代理
      startRoxynet()
    }
  })

  /** 获取软件设置 */
  ipcMain.on('app:getSoftConfig', (event,) => {
    return { ...store }
  })


  /** 重新拉起远程软件设置 */
  ipcMain.on('app:fetchSoftConfig', () => {
    console.log('远程系统配置发生变化，重新拉取远程配置')
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
      return chromeCoreManager.fetchAvailableCoreList()
    }
  })

  /** 检查更新 */
  ipcMain.on('app:checkForUpdates', (event,) => {
    appUpdater.checkForUpdates()
    webUpdater.checkForUpdates()
  })

  /** 检查是否有更新 */
  ipcMain.on('app:hasUpdate', (event,) => {
    return appUpdater.hasUpdate()
  })

  /** 安装更新 */
  ipcMain.on('app:quitAndInstall', (event, info) => {
    if (info.type === 'app') {
      appUpdater.upgradeNow()
    } else if (info.type === 'web') {
      webUpdater.upgradeNow()
    }
  })

  /** 获取所有可用的内核列表 */
  ipcMain.on('app:getCoreList', (event,) => {
    return chromeCoreManager.getCoreList()
  })

  /** 下载指定的内核 */
  ipcMain.on('app:download-chrome-core', (event, coreVersion) => {
    return chromeCoreManager.downloadCore(coreVersion)
  })

  /** 获取本机 mac address */
  ipcMain.on('app:getMacAddress', (event,) => {
    return getMacAddress()
  })

  /** 显示系统日志所在目录 */
  ipcMain.on('app:showLogDir', (event,) => {
    shell.openPath(appConfig.logsDir)
  })
  /** 程序化显示和隐藏红绿灯 */
  ipcMain.on('app:showHideTrafficLight', (event, show) => {
    getMainWindow()?.setWindowButtonVisibility(show)
  })

  /** 当前 APP 窗口是否是主窗口 */
  ipcMain.on('app:isMainWindow', (event,) => {
    return getMainWindow()?.id === BrowserWindow.fromWebContents(event.sender)?.id
  })

  /** 显示当前网页所在的窗口 */
  ipcMain.on('app:showCurrentWebviewWindow', (event,) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.show()
  })

  /** 开始移动窗口 */
  ipcMain.on('app:startMoveWindow', (event,) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win && startMoveWindow(win)
  })

  /** 停止移动窗口 */
  ipcMain.on('app:stopMoveWindow', (event,) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win && stopMoveWindow(win)
  })

  /** 获取系统 GPU 信息 */
  ipcMain.on('app:getGPUFeatureStatus', (event,) => {
    return app.getGPUFeatureStatus()
  })

  /** 动态设置窗口大小 */
  ipcMain.on('app:resizeWindow', (event, payload) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { x, y, width, height } = win?.getBounds()!
    payload.width ||= width
    payload.height ||= height
    win?.setBounds({ ...payload, x, y })
  })

  /** 开启系统代理 */
  ipcMain.on('app:setProxy', async (event, payload: Config) => {
    const mainWindow = getMainWindow()!
    console.log(payload)
    await mainWindow.webContents.session.setProxy({
      ...payload,
      proxyBypassRules: 'localhost',
    })
    console.log('代理设置完毕')
  })
  /** 关闭系统代理 */
  ipcMain.on('app:removeProxy', (event,) => {
    const mainWindow = getMainWindow()!
    mainWindow.webContents.session.setProxy({})
  })
}


