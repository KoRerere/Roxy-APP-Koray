import type { BrowserWindowConstructorOptions } from 'electron'
import axios from 'axios'
import { compare } from 'compare-versions'
import { app, BrowserWindow, screen } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { appConfig, mediaProtocolName, ROXY_MAIN_WINDOW_ID, ROXY_WINDOW_ID_KEY } from '/@/constants'
import { handleCloseWindow } from '/@/modules/app/utils'
import { store } from '/@/modules/store'
import { isDev, isPackaged, isProd, isWindows } from '/@/utils/'
import { handleWindowMove } from '/@/modules/sync-control/actionBar'

/** 获取 web 入口地址 */
export async function getWebEntryUrl(path: string, skipCompare = false) {
  if (isDev && import.meta.env.VITE_DEV_SERVER_URL !== undefined) {
    return `${import.meta.env.VITE_DEV_SERVER_URL}${path}`
  }

  if (isPackaged && !skipCompare) {
    try {
      const buildInWebVersion = await readFile(join(appConfig.buildInWebDir, 'version'), 'utf-8')
      const externalWebVersion = await readFile(join(appConfig.externalWebDir, 'version'), 'utf-8')
      store.isExternalWeb = compare(externalWebVersion, buildInWebVersion, '>')
    }
    catch (error) {
      store.isExternalWeb = false
    }
  }
  console.log('store.isExternalWeb', store.isExternalWeb)
  return `http://127.0.0.1:${store.appPort}/${path}`
}

/** 获取本地 web 版本 */
export async function getLocalWebVersion() {
  return axios.get<string>(await getWebEntryUrl('version', true)).then(response => response.data).catch(() => '')
}

/** 创建窗口 */
function createWindow(options?: BrowserWindowConstructorOptions) {
  const browserWindow = new BrowserWindow({
    // Use 'ready-to-show' event to show window
    show: false,
    resizable: false,
    autoHideMenuBar: true, // 自动隐藏菜单栏
    webPreferences: {
      spellcheck: false,
      // https://www.electronjs.org/docs/latest/api/webview-tag#warning
      webviewTag: false,
      preload: appConfig.preloadFilePath
      // devTools: !isProd,
    },
    ...options,
  })

  browserWindow[ROXY_WINDOW_ID_KEY] = ROXY_MAIN_WINDOW_ID

  browserWindow.webContents.session.protocol.registerFileProtocol(
    mediaProtocolName,
    (request, callback) => {
      const pathname = decodeURIComponent(request.url.replace(`${mediaProtocolName}:///`, ''))
      callback(pathname)
    },
  )

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
  })

  const launchUrl = await getWebEntryUrl(`launch${isPackaged ? '.html' : ''}`)
  console.log('intoLaunchPage', launchUrl)
  await launchWin.loadURL(launchUrl)
}

/** 进入主页面 */
export async function intoMainPage() {
  mainWindow?.removeAllListeners()
  closeMainWindow()
  const defaultWidth = 1280
  const defaultHeight = 832
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

  if (!isPackaged) {
    mainWin?.webContents.openDevTools({ mode: 'detach' })
  }
  console.log('进入主应用')
}

/** 更新主窗口页面标题 */
export async function updateMainWindowPageTitle() {
  const webVersion = await getLocalWebVersion()
  getMainWindow()?.setTitle(`${import.meta.env.VITE_APP_TITLE} Beta v${app.getVersion()}`)
}

let mainWindow: BrowserWindow | undefined

/**
 * 恢复现有的浏览器窗口或创建新的浏览器窗口
 */
export function restoreOrCreateWindow(options?: BrowserWindowConstructorOptions) {
  // mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed())
  console.log('restoreOrCreateWindow', mainWindow?.['ROXY:WINDOW_PROCESS_ID'])

  if (!mainWindow) {
    mainWindow = createWindow(options)
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.focus()
  return mainWindow
}

function closeMainWindow() {
  const win = mainWindow
  mainWindow?.close()
  mainWindow = undefined
  setTimeout(() => {
    win?.destroy()
  }, 3000)
}

/** 获取主窗口实例 */
export function getMainWindow() {
  return mainWindow
}
