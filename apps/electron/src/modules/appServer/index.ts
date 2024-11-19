import express from 'express'
import { join } from 'node:path'
import { getPortPromise } from 'portfinder'
import { setupRoxynetReceiver } from '/@/modules/appServer/roxynet-receiver'
import { setupMiddlewares } from '/@/modules/openapi/middlewares'
import { store } from '/@/modules/store'
import { setupDashboardServer } from './dashboard'
import { setLogsServer } from './logs/index'

export async function setupAppServer() {
  const { promise, resolve, reject } = Promise.withResolvers()
  const app = express()

  setupMiddlewares(app)
  // 注册日志服务
  setLogsServer(app)
  // 注册 roxynet 接收器
  setupRoxynetReceiver(app)
  // 注册工作台路由
  setupDashboardServer(app)

  app.use(express.static(join(__dirname, './web')))

  try {
    const port = await getPortPromise({ port: store.appPort })
    app.listen(port, () => {
      console.log(`App server is running at http://localhost:${port}`)
      store.appPort = port
      resolve(app)
    })
  }
  catch (error) {
    console.error('setupAppServer', error)
    reject(error)
  }
  return promise
}
