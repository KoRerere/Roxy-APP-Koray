import type { BrowserWindow, BrowserWindowConstructorOptions } from 'electron'
import axios from 'axios'
import { compare } from 'compare-versions'
import { app, screen } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { appConfig, ROXY_MAIN_WINDOW_ID } from '/@/constants'
import { isDev, isPackaged, isProd, isWindows } from '/@/constants/common'
import { sendLaunchMessage } from '/@/modules/app/checkResource'
import { handleCloseWindow } from '/@/modules/app/utils'
import { ipcMain } from '/@/modules/ipc'
import { store } from '/@/modules/store'
import { handleWindowMove } from '/@/modules/sync-control/actionBar'
import { createWindow } from '/@/utils/browser-window'

/** 获取 web 入口地址 */
export async function getWebEntryUrl(path: string, skipCompare = false) {
  if (isPackaged && !skipCompare) {
    try {
      const minimumAppVersion = await readFile(join(appConfig.externalWebDir, 'minimum_app_version'), 'utf-8').catch(() => '0.0.0')
      // 比较当前版本是否大于等于 web 资源要求的最低版本
      const isMinimumAppVersion = compare(app.getVersion(), minimumAppVersion, '>=')
      // 只有当前版本大于等于 web 资源要求的最低版本时才能使用外部 web 资源，否则使用内置 web 资源
      if (isMinimumAppVersion) {
        const buildInWebVersion = await readFile(join(appConfig.buildInWebDir, 'version'), 'utf-8')
        const externalWebVersion = await readFile(join(appConfig.externalWebDir, 'version'), 'utf-8')
        store.isExternalWeb = compare(externalWebVersion, buildInWebVersion, '>')
      }
      else {
        store.isExternalWeb = false
      }
    }
    catch (error) {
      store.isExternalWeb = false
    }
  }
  console.log('store.isExternalWeb', store.isExternalWeb)
  return `${appConfig.webBaseUrl}/${path}`
}

/** 获取本地 web 版本 */
export async function getLocalWebVersion() {
  return axios.get<string>(await getWebEntryUrl('version', true)).then(response => response.data).catch(() => '0.0.0')
}

/** 创建窗口 */
function createMainWindow(options?: BrowserWindowConstructorOptions) {
  const browserWindow = createWindow({
    // Use 'ready-to-show' event to show window
    roxyWindowId: ROXY_MAIN_WINDOW_ID,
    show: false,
    resizable: false,
    autoHideMenuBar: true, // 自动隐藏菜单栏
    center: true,
    ...options,
  })

  /**
   * @see https://github.com/electron/electron/issues/25012
   */
  browserWindow.on('ready-to-show', () => {
    browserWindow?.show?.()
  })

  if (isProd) {
    // 生产禁用菜单栏
    // browserWindow.setMenu(null)
  }

  return browserWindow
}

/** 进入启动页 */
export async function intoLaunchPage() {
  const launchWin = restoreOrCreateWindow({
    width: 640,
    height: 384,
    resizable: false,
    frame: isWindows,
    titleBarStyle: 'customButtonsOnHover',
  })

  const launchUrl = await getWebEntryUrl(`launch${isPackaged ? '.html' : ''}`)
  console.log('intoLaunchPage', launchUrl)
  await launchWin.loadURL(launchUrl)
  sendLaunchMessage($t('正在初始化应用...'))
}

/** 进入主页面 */
export async function intoMainPage() {
  closeMainWindow()
  const defaultWidth = 1440
  const defaultHeight = 960
  const minWidth = 960
  const minHeight = 640
  // 获取屏幕大小
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  const mainWin = restoreOrCreateWindow({
    width: Math.min(defaultWidth, width),
    height: Math.min(defaultHeight, height),
    minWidth: Math.min(minWidth, width),
    minHeight: Math.min(minHeight, height),
    resizable: true,
  })
  const webUrl = await getWebEntryUrl(isPackaged ? 'index.html' : '')
  console.log('intoMainPage', webUrl)
  await mainWin.loadURL(webUrl)
  await updateMainWindowPageTitle()
  // 禁用 document.title 的影响
  mainWin.on('page-title-updated', (event) => {
    event.preventDefault()
  })

  handleWindowMove(mainWin)

  mainWin.on('close', (event) => {
    console.log('on window close')
    handleCloseWindow(event)
  })

  mainWin.on('focus', (event) => {
    ipcMain.send('window:on-focus')
  })

  if (!isPackaged) {
    mainWin?.webContents.openDevTools({ mode: 'detach' })
  }
  console.log('Entering main application')
}

/** 更新主窗口页面标题 */
export async function updateMainWindowPageTitle() {
  const webVersion = await getLocalWebVersion()
  getMainWindow()?.setTitle(`${import.meta.env.VITE_APP_TITLE} v${app.getVersion()}`)
}

let mainWindow: BrowserWindow | undefined

/**
 * 恢复现有的浏览器窗口或创建新的浏览器窗口
 */
export function restoreOrCreateWindow(options?: BrowserWindowConstructorOptions) {
  // mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed())
  console.log('restoreOrCreateWindow', mainWindow?.['ROXY:WINDOW_PROCESS_ID'])

  if (!mainWindow) {
    mainWindow = createMainWindow(options)
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.setSkipTaskbar(false)

  mainWindow.setAlwaysOnTop(true)
  mainWindow.show()
  mainWindow.focus()
  mainWindow.setAlwaysOnTop(false)
  return mainWindow
}

function closeMainWindow() {
  mainWindow?.removeAllListeners?.()
  mainWindow?.close?.()
  mainWindow = undefined
}

/** 获取主窗口实例 */
export function getMainWindow() {
  return mainWindow
}
