import './logs/index'
import express from 'express'
import { join } from 'node:path'
import { getPortPromise } from 'portfinder'
import { setupLuminetReceiver } from '/@/modules/appServer/luminet-receiver'
import { setupMiddlewares } from '/@/modules/openapi/middlewares'
import { store } from '/@/modules/store'
import { setupDashboardServer } from './dashboard'

export async function setupAppServer() {
  const { promise, resolve, reject } = Promise.withResolvers()
  const app = express()

  setupMiddlewares(app)

  // 注册工作台路由
  setupDashboardServer(app)
  // 注册 luminet 接收器
  setupLuminetReceiver(app)

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
