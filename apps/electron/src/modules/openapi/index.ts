import type { Server } from 'node:http'
import express from 'express'
import { API } from '/@/api'
import { store } from '/@/modules/store'
import { setupMiddlewares } from './middlewares/'
import { setupRoutes } from './routes/'

class OpenAPIServer {
  #server?: Server

  constructor(private app = express()) {
    // 注册中间件
    setupMiddlewares(this.app)
    // 注册路由
    setupRoutes(this.app)
    // 打印已注册的路由
    // this.printRoutes()
  }

  async start() {
    this.stop()

    const { code, data, msg } = await API.base.userGetUserApiList()

    if (code === 0 && data.open) {
      this.#server = this.app.listen(data.port, () => {
        console.log(`OpenAPI server is running on ${data.port}`)
      })
      store.apiKey = data.apiKey
    }
    else {
      console.log('OpenAPI server failed to start:', msg)
    }
  }

  stop() {
    this.#server?.close()
  }

  private printRoutes() {
    const routes: any[] = []

    this.app._router.stack.forEach((middleware: any) => {
      if (middleware.route && middleware.route.path !== '*') { // routes registered directly on the app
        routes.push({
          path: middleware.route.path,
          methods: middleware.route.methods,
        })
      }
      else if (middleware.name === 'router') { // router middleware
        middleware.handle.stack.forEach((handler: any) => {
          const route = handler.route
          if (route && route.path !== '*') {
            routes.push({
              path: route.path,
              methods: route.methods,
            })
          }
        })
      }
    })

    console.log('Registered routes:', routes)
  }
}

let openAPIServer: OpenAPIServer

export function setupOpenAPIServer() {
  openAPIServer ||= new OpenAPIServer()
  openAPIServer.start()
  return openAPIServer
}
