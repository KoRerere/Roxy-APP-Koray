import type { BrowserWindowConstructorOptions } from 'electron'
import { app, BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { mediaProtocolName } from '/@/constants'
import { handleCloseWindow } from '/@/modules/app/utils'
import { store } from '/@/modules/store'
import { isDev, isPackaged, isProd, isWindows } from '/@/utils/'

/** 获取 web 入口地址 */
export function getWebEntryUrl(path: string) {
  if (isDev && import.meta.env.VITE_DEV_SERVER_URL !== undefined) {
    return `${import.meta.env.VITE_DEV_SERVER_URL}${path}`
  }
  return `http://localhost:${store.appPort}/${path}`
}

/** 创建窗口 */
async function createWindow(options?: BrowserWindowConstructorOptions) {
  const browserWindow = new BrowserWindow({
    // Use 'ready-to-show' event to show window
    show: false,
    resizable: false,
    autoHideMenuBar: true, // 自动隐藏菜单栏
    webPreferences: {
      spellcheck: false,
      // https://www.electronjs.org/docs/latest/api/webview-tag#warning
      webviewTag: false,
      preload: isPackaged ? join(__dirname, './preload/index.cjs') : join(__dirname, '../../preload/dist/index.cjs'),
      // devTools: !isProd,
    },
    ...options,
  })

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
    browserWindow?.show()
  })

  if (isProd) {
    // 生产禁用菜单栏
    // browserWindow.setMenu(null)
  }

  return browserWindow
}

/** 进入启动页 */
export async function intoLaunchPage() {
  const launchWin = await restoreOrCreateWindow({
    width: 640,
    height: 384,
    resizable: false,
    frame: isWindows,
  })

  const launchUrl = getWebEntryUrl(`launch${isPackaged ? '.html' : ''}`)
  console.log('intoLaunchPage', launchUrl)
  await launchWin.loadURL(launchUrl)
}

/** 进入主页面 */
export async function intoMainPage() {
  closeMainWindow()
  const defaultWidth = 1280
  const defaultHeight = 832
  const minWidth = 960
  const minHeight = 640
  // 获取屏幕大小
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  const mainWin = await restoreOrCreateWindow({
    width: Math.min(defaultWidth, width),
    height: Math.min(defaultHeight, height),
    minWidth: Math.min(minWidth, width),
    minHeight: Math.min(minHeight, height),
    resizable: true,
  })
  const webUrl = getWebEntryUrl(isPackaged ? 'index.html' : '')
  console.log('intoMainPage', webUrl)
  await mainWin.loadURL(webUrl)
  mainWin.setTitle(`${import.meta.env.VITE_APP_TITLE} | ${app.getVersion()}`)
  // 禁用 document.title 的影响
  mainWin.on('page-title-updated', (event) => {
    event.preventDefault()
  })

  mainWin.on('close', (event) => {
    console.log('on window close')
    handleCloseWindow(event)
  })

  if (!isPackaged) {
    mainWin?.webContents.openDevTools({ mode: 'detach' })
  }
  console.log('进入主应用')
}

let mainWindow: BrowserWindow | undefined

/**
 * 恢复现有的浏览器窗口或创建新的浏览器窗口
 */
export async function restoreOrCreateWindow(options?: BrowserWindowConstructorOptions) {
  // mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed())
  console.log('restoreOrCreateWindow', mainWindow)

  if (!mainWindow) {
    mainWindow = await createWindow(options)
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
  }, 1000)
}

/** 获取主窗口实例 */
export function getMainWindow() {
  return mainWindow
}
