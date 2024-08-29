import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { isDev, isProd } from '/@/utils/'

async function createWindow() {
  const browserWindow = new BrowserWindow({
    width: 1240,
    height: 765,
    // Use 'ready-to-show' event to show window
    show: false,
    webPreferences: {
      // https://www.electronjs.org/docs/latest/api/webview-tag#warning
      webviewTag: false,
      preload: isProd ? join(__dirname, './preload/index.cjs') : join(__dirname, '../../preload/dist/index.cjs'),
      devTools: isDev,
    },
  })

  /**
   * @see https://github.com/electron/electron/issues/25012
   */
  browserWindow.on('ready-to-show', () => {
    browserWindow?.show()

    if (isDev) {
      browserWindow?.webContents.openDevTools({ mode: 'detach' })
    }

    // browserWorkerManager.postMessage({ type: 'ready' })
    // browserWorkerManager.onMessage((message) => {
    //   console.log('Message from worker thread:', message)
    // })
  })

  const pageUrl
    = isDev && import.meta.env.VITE_DEV_SERVER_URL !== undefined
      ? import.meta.env.VITE_DEV_SERVER_URL
      : `file://${join(__dirname, './web/index.html')}`

  await browserWindow.loadURL(pageUrl)

  console.log('createWindow', pageUrl)
  // setTimeout(() => {
  //   API.window.userGetWindowInfoList({}).then(async (res) => {
  //     const winInfoList = res.data.rows
  //     await browserManager.batchLaunch(winInfoList.slice(0, 2))
  //   })
  // }, 5000)

  return browserWindow
}

/**
 * 恢复现有的浏览器窗口或创建新的浏览器窗口
 */
export async function restoreOrCreateWindow() {
  let window = BrowserWindow.getAllWindows().find(w => !w.isDestroyed())

  if (window === undefined) {
    window = await createWindow()
  }

  if (window.isMinimized()) {
    window.restore()
  }

  window.focus()
  return window
}
