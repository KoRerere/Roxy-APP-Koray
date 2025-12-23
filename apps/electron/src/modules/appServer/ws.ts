import { getPortPromise } from 'portfinder'
import { WebSocketServer } from 'ws'
import { browserManager } from '/@/modules/browser'
import { store } from '/@/modules/store'

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
        await handleMessage(msg)
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

async function handleMessage(message: any) {
  if (message.type === 'browser:open-url') {
    console.debug('browser:open-url', message)
    const { dirId, url } = message
    if (dirId && url) {
      console.debug('browser:open-url', dirId, url)
      const browser = browserManager.openedBrowserMap.get(dirId)
      if (browser) {
        browser.getBrowser()?.newPage().then((page) => {
          page.goto(url)
        })
      }
    }
  }
}
