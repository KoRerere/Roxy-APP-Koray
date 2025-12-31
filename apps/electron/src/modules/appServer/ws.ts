import type { OpenBrowserFailureType } from '@roxy/electron-preload'
import type { WebSocket } from 'ws'
import { BrowserWindow } from 'electron'
import { basename, extname } from 'node:path'
import { getPortPromise } from 'portfinder'
import { WebSocketServer } from 'ws'
import { API } from '/@/api'
import { ROXY_DEFAULT_BROWSER_WINDOW_ID, ROXY_WINDOW_ID_KEY } from '/@/constants'
import { isPackaged } from '/@/constants/common'
import { getWebEntryUrl, restoreOrCreateWindow } from '/@/modules/app/mainWindow'
import { browserManager } from '/@/modules/browser'
import { ipcMain } from '/@/modules/ipc'
import { shortcutStore } from '/@/modules/shortcut-manager/ShortcutStore'
import { store } from '/@/modules/store'
import { getErrorMessage } from '/@/utils'
import { createWindow } from '/@/utils/browser-window'

let wss: WebSocketServer | null = null
const TOKEN = 'roxybrowser'

function getTokenFromRequest(req: { url?: string, headers: Record<string, any> }) {
  // 1) 浏览器 WebSocket：无法自定义 header，建议用 ws://127.0.0.1:port?token=xxx
  try {
    const u = new URL(req.url ?? '/', 'http://127.0.0.1')
    const t = u.searchParams.get('token')
    if (t)
      return t
  }
  catch {
    // ignore
  }

  // 2) Node 客户端：可使用 header
  const headerToken = req.headers?.token ?? req.headers?.['x-roxy-token']
  if (typeof headerToken === 'string' && headerToken)
    return headerToken

  // 3) 兼容：用 subprotocol 传递（可选）
  // 浏览器可以设置 protocols 参数：new WebSocket(url, ['token-xxx'])
  const proto = req.headers?.['sec-websocket-protocol']
  if (typeof proto === 'string' && proto)
    return proto

  return null
}

export async function setupWebSocketServer() {
  store.appWsPort = await getPortPromise({ port: store.appWsPort })

  wss = new WebSocketServer({
    port: store.appWsPort,
    verifyClient: (info, callback) => {
      const token = getTokenFromRequest(info.req as any)
      if (token !== TOKEN) {
        // ws v8：callback(false, code, message)
        return callback(false, 401, 'Unauthorized')
      }
      return callback(true)
    },
  })

  wss.on('connection', (ws, req) => {
    console.debug('A new client connected to the WebSocket server', req.url ?? '')

    ws.on('message', async (data, isBinary) => {
      const message = isBinary ? data : data.toString()
      console.debug('WebSocket message:', message)
      try {
        const msg = JSON.parse(message)
        await handleMessage(ws, msg)
      }
      catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    })

    ws.on('error', (error) => {
      console.debug('WebSocket client error:', error)
    })

    ws.on('close', (code, reason) => {
      const r = reason?.toString?.() ?? ''
      console.debug('WebSocket client closed:', { code, reason: r })
    })
  })

  wss.on('error', (error) => {
    console.debug('WebSocket error:', error)
  })

  wss.on('close', () => {
    console.debug('WebSocket server closed')
  })
}

export function sendMessageToAllClients(message: string | Record<string, any>) {
  if (wss) {
    wss.clients.forEach(client => client.send(typeof message === 'string' ? message : JSON.stringify(message)))
  }
}

async function handleMessage(ws: WebSocket, message: any) {
  console.debug('handleMessage 22', message, store.token)

  if (message?.pid) {
    store.defaultBrowserLauncherPid = Number(message.pid)
  }

  const sendMessage = (message: any) => {
    ws.send(JSON.stringify(message))
  }

  // 如果没有登录，则提示用户登录
  if (!store.token) {
    sendMessage({ type: 'app:login-required', dirId: message.dirId })
    await openBrowserFailedDialog(message.dirId, 'not_login')
    return
  }

  // 打开 URL
  if (message.type === 'browser:open-url') {
    console.debug('browser:open-url', message)
    const { dirId, url } = message
    if (dirId && url) {
      console.debug('browser:open-url', dirId, url)
      const browser = await browserManager.getOpenedBrowser(dirId)
      if (browser) {
        browser.getBrowser()?.newPage().then((page) => {
          page.goto(url)
        })
      }
    }
  }

  // 查询当前窗口是否已打开
  if (message.type === 'browser:is-opened') {
    console.debug('browser:is-opened', message)
    const { dirId } = message
    if (dirId) {
      console.debug('browser:is-opened', dirId)
      const browser = browserManager.openedBrowserMap.get(dirId)
      sendMessage({ type: 'browser:is-opened', dirId, opened: Boolean(browser) })
    }
  }

  // 打开指定的窗口
  if (message.type === 'browser:open-window') {
    console.debug('browser:open-window', message)
    const { dirId, workspaceId, url } = message
    if (dirId && workspaceId) {
      await openBrowserWindow(dirId, workspaceId, url, sendMessage)
    }
  }
}

/** 打开浏览器窗口 */
export async function openBrowserWindow(dirId: string, workspaceId: number, url = '', sendMessage = (_: any) => {}) {
  try {
    console.debug('browser:open-window', dirId, workspaceId)
    const result = await API.window.userGetWindowInfoV2List({ isDelete: 0, sourceType: 'open', dirIds: dirId }, {
      headers: {
        workspaceId,
      },
    })
    console.debug('browser:open-window result', result)
    if (result.code === 0) {
      if (result.data.rows.length > 0) {
        const winInfo = result.data.rows[0]
        console.debug('browser:open-window', winInfo)
        if (winInfo) {
          const timer = setTimeout(async () => {
            const lastMessage = browserManager.openingBrowserMap.get(dirId)?.browserItem?.beforeLaunchTask?.lastMessage

            if (lastMessage && lastMessage.percent < 80) {
              await showDefaultBrowserWindow(dirId)
            }
          }, 3000)
          browserManager.launch(winInfo)
            .then(() => {
              if (url) {
                browserManager.openedBrowserMap.get(dirId)?.getBrowser()?.newPage().then((page) => {
                  page.goto(url)
                })
              }
            })
            .catch((error) => {
              openBrowserFailedDialog(dirId, 'other_error', getErrorMessage(error))
            })
            .finally(() => {
              clearTimeout(timer)
            })
        }
      }
      else {
        sendMessage({ type: 'browser:open-window', dirId, workspaceId, success: false, message: 'window not found' })
        await openBrowserFailedDialog(dirId, 'window_not_found')
      }
    }
    else {
    // 未登录
      if (result.code === 403) {
        await openBrowserFailedDialog(dirId, 'not_login')
      }
      // 没有空间权限或被移出空间
      else if (result.code === 418) {
        await openBrowserFailedDialog(dirId, 'no_permission')
      }
      else {
        await openBrowserFailedDialog(dirId, 'other_error', result.msg)
      }
      sendMessage({ type: 'browser:open-window', dirId, workspaceId, success: false, message: result.msg })
    }
  }
  catch (error) {
    sendMessage({ type: 'browser:open-window', dirId, workspaceId, success: false, message: getErrorMessage(error) })
  }
}

/** 显示默认浏览器启动中的窗口 */
async function showDefaultBrowserWindow(dirId: string) {
  const url = await getWebEntryUrl(`default-browser${isPackaged ? '.html' : ''}?dirId=${dirId}`)
  console.log('showDefaultBrowserWindow', url)

  const win = createWindow({
    roxyWindowId: dirId,
    width: 640,
    height: 384,
    frame: false,
    skipTaskbar: true,
    center: true,
    resizable: false,
    hasShadow: true,
    alwaysOnTop: true,
    titleBarStyle: 'customButtonsOnHover',
  })

  win.loadURL(url)
  // win.setShape([])
  // 设置窗口部分点击可穿透
  // win.setIgnoreMouseEvents(true);
  if (!isPackaged) {
    win.webContents.openDevTools()
  }
  win.on('close', () => {
    win.destroy()
  })
}

export async function openBrowserFailedDialog(dirId: string, type: OpenBrowserFailureType, message?: string) {
  const targetWindows = BrowserWindow.getAllWindows().filter(win => win[ROXY_WINDOW_ID_KEY] === dirId)

  targetWindows.forEach(win => win.close())

  const shortcut = await shortcutStore.get(dirId)
  console.debug('openBrowserFailedDialog shortcut', dirId, shortcut)
  const name = await Promise.try(() => basename(shortcut.launcherEntry, extname(shortcut.launcherEntry))).catch(() => $t('默认浏览器'))
  console.debug('openBrowserFailedDialog name', name)
  ipcMain.send('dialog:open-browser-failed', { name, type, message })
  restoreOrCreateWindow()
}
