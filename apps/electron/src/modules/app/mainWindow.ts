import { app, BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { mediaProtocolName } from '/@/constants'
import { handleCloseWindow } from '/@/modules/app/utils'
import { store } from '/@/modules/store'
import { isDev, isPackaged } from '/@/utils/'

/** 获取 web 入口地址 */
export function getWebEntryUrl(path: string) {
  if (isDev && import.meta.env.VITE_DEV_SERVER_URL !== undefined) {
    return `${import.meta.env.VITE_DEV_SERVER_URL}${path}`
  }
  return `http://localhost:${store.appPort}/${path}`
}

/** 创建窗口 */
async function createWindow() {
  const browserWindow = new BrowserWindow({
    width: 640,
    height: 384,
    // Use 'ready-to-show' event to show window
    show: false,
    resizable: false,
    autoHideMenuBar: true, // 自动隐藏菜单栏
    webPreferences: {
      spellcheck: false,
      // https://www.electronjs.org/docs/latest/api/webview-tag#warning
      webviewTag: false,
      preload: isPackaged ? join(__dirname, './preload/index.cjs') : join(__dirname, '../../preload/dist/index.cjs'),
      devTools: isDev,
    },
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

  browserWindow.on('close', (event) => {
    console.log('on window close')
    handleCloseWindow(event)
  })

  await browserWindow.loadURL(getWebEntryUrl(`launch${isPackaged ? '.html' : ''}`))

  console.log('createWindow', getWebEntryUrl('launch'))

  if (!isPackaged) {
    browserWindow?.webContents.openDevTools({ mode: 'detach' })
  }

  return browserWindow
}

/** 进入主页面 */
export async function intoMainPage() {
  const defaultWidth = 1280
  const defaultHeight = 832
  const minWidth = 960
  const minHeight = 640

  const win = getMainWindow()!
  // 获取屏幕大小
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  win.hide()
  win.setResizable(true)
  win.setBounds({ width: Math.min(defaultWidth, width), height: Math.min(defaultHeight, height) }, false)
  win.setMinimumSize(Math.min(minWidth, width), Math.min(minHeight, height))
  win.center()
  await win.loadURL(getWebEntryUrl(isPackaged ? 'index.html' : ''))
  win.setTitle(`${win.getTitle()} | ${app.getVersion()}`)
  console.log('进入主应用')
  setTimeout(() => {
    win.show()
  }, 300)
}

let mainWindow: BrowserWindow | undefined

/**
 * 恢复现有的浏览器窗口或创建新的浏览器窗口
 */
export async function restoreOrCreateWindow() {
  mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed())

  if (mainWindow === undefined) {
    mainWindow = await createWindow()
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.focus()
  return mainWindow
}

/** 获取主窗口实例 */
export function getMainWindow() {
  return mainWindow
}
