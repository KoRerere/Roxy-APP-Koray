import type express from 'express'
import { store } from '/@/modules/store'

export function setupLuminetReceiver(app: express.Express) {
  // 上报代理端口（同时http和socks5协议）
  app.get('/tunnel/report_proxy_server', (req, res) => {
    console.log('report_proxy_server', req.query.port)
    store.roxynetProxyPort = Number(req.query.port)
    res.json(req.query)
  })

  // 上报本地http服务端口
  app.get('/tunnel/report_local_http', (req, res) => {
    console.log('report_local_http', req.query.port)
    store.luminetLocalHttpPort = Number(req.query.port)
    res.json(req.query)
  })
}
