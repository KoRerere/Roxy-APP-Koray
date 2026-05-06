import express from 'express'
import { getPortPromise } from 'portfinder'
import { setupRoxynetReceiver } from '/@/modules/appServer/roxynet-receiver'
import { setupWebSocketServer } from '/@/modules/appServer/ws'
import { setupMiddlewares } from '/@/modules/openapi/middlewares'
import { store } from '/@/modules/store'
import { setupDashboardServer } from './dashboard'
// import { setLogsServer } from './logs/index'

export async function setupAppServer() {
  const { promise, resolve, reject } = Promise.withResolvers()
  const app = express()

  setupMiddlewares(app)
  // 注册日志服务
  // setLogsServer(app)
  // 注册 roxynet 接收器
  setupRoxynetReceiver(app)
  // 注册工作台路由
  await setupDashboardServer(app)
  // 静态资源配置：只禁用 html 缓存
  // const staticOptions = {
  //   dotfiles: 'allow' as const,
  //   setHeaders: (res: any, path: string) => {
  //     if (path.endsWith('.html')) {
  //       res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  //       res.set('Pragma', 'no-cache')
  //       res.set('Expires', '0')
  //       res.set('Surrogate-Control', 'no-store')
  //     }
  //   },
  // }

  // APP 内置 web 服务中间件
  // const buildInWebMid = express.static(appConfig.buildInWebDir, staticOptions)
  // // APP 外置 web 服务中间件
  // const externalWebMid = express.static(appConfig.externalWebDir, staticOptions)
  // APP web 服务中间件
  // app.use(async (req, res, next) => {
  //   if (store.isExternalWeb) {
  //     externalWebMid(req, res, next)
  //   }
  //   else {
  //     buildInWebMid(req, res, next)
  //   }
  // })

  try {
    const port = await getPortPromise({ port: store.appPort })
    app.listen(port, (error) => {
      if (error) {
        reject(error)
        return
      }
      console.log(`App server is running at http://127.0.0.1:${port}`)
      store.appPort = port
      resolve(app)
    })
    // 启动 WebSocket 服务
    await setupWebSocketServer()
  }
  catch (error) {
    console.error('setupAppServer', error)
    reject(error)
  }

  return promise
}
