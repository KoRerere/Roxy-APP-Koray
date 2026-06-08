import type { OpenBrowserFailureType } from '@roxy/electron-preload'
import type { WebSocket } from 'ws'
import { BrowserWindow } from 'electron'
import { basename, extname } from 'node:path'
import { getPortPromise } from 'portfinder'
import { WebSocketServer } from 'ws'
import { API } from '/@/api'
import { ROXY_WINDOW_ID_KEY } from '/@/constants'
import { isPackaged } from '/@/constants/common'
import { getWebEntryUrl, restoreOrCreateWindow } from '/@/modules/app/mainWindow'
import { browserManager } from '/@/modules/browser'
import { CoreType } from '/@/modules/browser/browser-manager/adapter'
import { ipcSender } from '/@/modules/ipc/sender'
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

    ws.on('message', async (data, _isBinary) => {
      // ws(v8) 的 data 可能是 Buffer/ArrayBuffer/Buffer[]；这里统一转成 string 再 JSON.parse
      const raw = (() => {
        if (typeof data === 'string')
          return data
        // Buffer | ArrayBuffer | Buffer[]
        // eslint-disable-next-line node/prefer-global/buffer
        return Buffer.isBuffer(data) ? data.toString() : Buffer.from(data as any).toString()
      })()
      console.debug('WebSocket message:', raw)
      try {
        const msg = JSON.parse(raw)
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

  // 查询当前窗口是否已打开
  if (message.type === 'browser:is-opened') {
    console.debug('browser:is-opened', message)
    const { dirId } = message
    if (dirId) {
      console.debug('browser:is-opened', dirId)
      const browser = browserManager.openedBrowserMap.get(dirId)
      sendMessage({ type: 'browser:is-opened', dirId, opened: Boolean(browser) })
    }
    return
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
      const browserItem = await browserManager.getOpenedBrowser(dirId)
      if (browserItem) {
        await browserItem.openUrls([url]).catch((error) => {
          console.error('browser:open-url failed:', error)
        })
      }
    }
  }

  // 打开指定的窗口
  if (message.type === 'browser:open-window') {
    console.debug('browser:open-window', message)
    const { dirId, workspaceId, url, urls } = message
    if (dirId && workspaceId) {
      // 兼容：url 为单个；urls 为批量
      const list: string[] = Array.isArray(urls) ? urls.filter(Boolean) : []
      const firstUrl = typeof url === 'string' ? url : ''
      if (!list.length && firstUrl)
        list.push(firstUrl)
      await openBrowserWindow(dirId, workspaceId, list, sendMessage)
    }
  }
}

/** 打开浏览器窗口 */
export async function openBrowserWindow(dirId: string, workspaceId: number, urls: string[] = [], sendMessage = (_: any) => { }) {
  try {
    console.debug('browser:open-window', dirId, workspaceId)
    // API 类型定义与后端字段可能不同步：这里按现有后端接口实参传递，必要时用 any 兜底
    const result = await API.window.userGetWindowInfoV2List({ isDelete: 0, sourceType: 'open', dirIds: dirId } as any, {
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
              await showDefaultBrowserWindow(dirId, winInfo.coreType as CoreType || CoreType.Chrome)
            }
          }, 3000)
          browserManager.launch(winInfo as any)
            .then(async () => {
              // 等浏览器真正打开后，再统一打开 URL（避免外部提前发 open-url 丢失）
              const list = Array.isArray(urls) ? urls.filter(Boolean) : []
              if (!list.length)
                return
              const browserItem = browserManager.openedBrowserMap.get(dirId)
              if (!browserItem)
                return
              await browserItem.openUrls(list).catch((error) => {
                console.error('browser:open-window openUrls failed:', error)
              })
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
      else if (result.code === 422) {
        await openBrowserFailedDialog(dirId, 'workspace_suspended')
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
async function showDefaultBrowserWindow(dirId: string, coreType: CoreType) {
  const url = await getWebEntryUrl(`default-browser${isPackaged ? '.html' : ''}?dirId=${dirId}&coreType=${coreType}`)
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
  ipcSender.dialog.openBrowserFailed({ name, type, message })
  restoreOrCreateWindow()
  shortcutStore.remove(dirId)
}
