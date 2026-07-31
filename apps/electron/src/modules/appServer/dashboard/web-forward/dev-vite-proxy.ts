import type { RequestHandler } from 'http-proxy-middleware'
import type { Server } from 'node:http'
import type { Socket } from 'node:net'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { isPackaged } from '/@/constants/common'

let devViteProxyMiddleware: RequestHandler | null = null

/** 获取开发态 Vite 反向代理（HTTP + WS 共用同一实例）。 */
export function getDevViteProxyMiddleware() {
  if (isPackaged) {
    return null
  }

  const devServerUrl = import.meta.env.VITE_DEV_SERVER_URL?.replace(/\/$/, '')
  if (!devServerUrl) {
    return null
  }

  devViteProxyMiddleware ||= createProxyMiddleware({
    target: devServerUrl,
    changeOrigin: true,
    ws: true,
  })

  return devViteProxyMiddleware
}

/**
 * 开发态将 appServer 上的 WebSocket upgrade 转发到 Vite dev server。
 * 工作台经 127.0.0.1:appPort 代理加载时，@vite/client 仍会对同源发起 HMR 连接。
 */
export function setupDevViteWebSocketProxy(httpServer: Server) {
  const proxy = getDevViteProxyMiddleware()
  if (!proxy) {
    return
  }

  httpServer.on('upgrade', (req, socket, head) => {
    if (req.headers.upgrade?.toLowerCase() !== 'websocket') {
      return
    }

    proxy.upgrade(req, socket as Socket, head)
  })

  console.log('[web-forward] dev Vite proxy enabled', import.meta.env.VITE_DEV_SERVER_URL)
}
