import type { BrowserWindow, BrowserWindowConstructorOptions } from 'electron'
import { app, screen } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { appConfig, ROXY_MAIN_WINDOW_ID } from '/@/constants'
import { isPackaged, isWindows } from '/@/constants/common'
import { sendLaunchMessage } from '/@/modules/app/checkResource'
import { handleCloseWindow } from '/@/modules/app/utils'
import { isDevToolsUnlocked } from '/@/modules/devtools-guard'
import { ipcSender } from '/@/modules/ipc/sender'
import { store } from '/@/modules/store'
import { handleWindowMove } from '/@/modules/sync-control/actionBar'
import { request } from '/@/utils'
import { createWindow } from '/@/utils/browser-window'
import {
  getProdWebDomain,
  getRemainingProdWebOrigins,
  markProdWebDomainFailed,
  rememberProdWebDomain,
  replaceWebOrigin,
} from '/@/utils/getProdWebDomain'

/** 主框架 failover 进行中，避免 did-fail-load 与 loadURL reject 重复切入 */
let mainFrameFailoverInFlight = false

/** 获取 web 入口地址 */
export async function getWebEntryUrl(path: string) {
  const prodWebDomain = await getProdWebDomain()

  return `${isPackaged ? prodWebDomain : import.meta.env.VITE_DEV_SERVER_URL?.replace(/\/$/, '')}/${path}`
}

/** 获取本地 web 版本 */
export async function getLocalWebVersion() {
  return request.get<string>(await getWebEntryUrl('version')).then(response => response.data).catch(() => '0.0.0')
}

/** 内置连接异常页（file://），主框架远程加载全部失败后使用 */
function getBuiltinErrorPageUrl() {
  return pathToFileURL(join(appConfig.buildInWebDir, '500.html')).href
}

/** 当前导航是否已经是内置 500 页，避免失败回调再次切入 failover */
function isBuiltinErrorPage(url: string) {
  return url.startsWith('file:') && url.includes('500.html')
}

/**
 * Chromium 主框架加载失败后依次尝试其它 Web 域名。
 * axios 探测成功不代表 Chromium（QUIC/HTTP2/证书）也能连上，所以必须用 loadURL 本身做 failover。
 */
async function handleMainFrameLoadFailure(mainWin: BrowserWindow, failedUrl: string) {
  if (mainWin.isDestroyed() || isBuiltinErrorPage(failedUrl) || mainFrameFailoverInFlight) {
    return
  }

  mainFrameFailoverInFlight = true
  try {
    if (isPackaged && failedUrl.startsWith('http')) {
      const origins = getRemainingProdWebOrigins(failedUrl)
      for (const origin of origins) {
        if (mainWin.isDestroyed()) {
          return
        }
        const nextUrl = replaceWebOrigin(failedUrl, origin)
        console.log('[MainWindow] Chromium load failed, try next web domain', { failedUrl, nextUrl })
        try {
          await mainWin.loadURL(nextUrl)
          rememberProdWebDomain(origin)
          return
        }
        catch (error) {
          console.warn('[MainWindow] next web domain also failed', { nextUrl, error })
          markProdWebDomainFailed(origin)
        }
      }
    }

    if (!mainWin.isDestroyed()) {
      console.log('[MainWindow] all web domains failed, show 500', { failedUrl })
      await mainWin.loadURL(getBuiltinErrorPageUrl())
    }
  }
  catch (error) {
    console.error('[MainWindow] failed to show 500 page', error)
  }
  finally {
    mainFrameFailoverInFlight = false
  }
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
    webPreferences: {
      // 主窗口禁用节流
      // backgroundThrottling: false,
    },
    ...options,
  })

  /**
   * @see https://github.com/electron/electron/issues/25012
   */
  // browserWindow.on('ready-to-show', () => {
  //   browserWindow?.show?.()
  // })

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
  // loadURL 必须是带协议的 URL；裸文件路径会被判为非法，错误信息常体现为 loading ''
  if (isPackaged) {
    const localLaunch = join(appConfig.buildInWebDir, 'launch.html')
    await launchWin.loadURL(pathToFileURL(localLaunch).href)
  }
  else {
    await launchWin.loadURL(launchUrl)
  }
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

  mainWin.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame)
      return

    // ERR_ABORTED：后续 loadURL 取消了当前导航，不是真正的线路失败
    if (errorCode === -3)
      return

    console.log('页面加载失败：', {
      errorCode,
      errorDescription,
      url: validatedURL,
    })

    void handleMainFrameLoadFailure(mainWin, validatedURL)
  })

  try {
    if (store.isFirstClearWebCache) {
      await mainWin.webContents.session.clearCache()
      await mainWin.webContents.session.clearStorageData({
        storages: ['serviceworkers', 'cachestorage'],
      })
      store.isFirstClearWebCache = false
    }
  }
  catch (error) {

  }

  await mainWin.loadURL(webUrl).catch((error) => {
    // did-fail-load 会走域名 failover / 500 页；这里只记日志，避免重复导航打断正在进行的切线
    console.error('intoMainPage error', error)
  })
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
    ipcSender.window.onFocus()
  })

  if (isDevToolsUnlocked()) {
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
