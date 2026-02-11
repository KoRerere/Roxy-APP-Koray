import type { Server } from 'node:http'
import express from 'express'
import { API } from '/@/api'
import { store } from '/@/modules/store'
import { setupMiddlewares } from './middlewares/'
import { setupRoutes } from './routes/'

export const openAPIServer = new class OpenAPIServer {
  #server: Server | null = null

  constructor(private app = express()) {
    // 注册中间件
    setupMiddlewares(this.app)
    // 注册路由
    setupRoutes(this.app)
    // 打印已注册的路由
    // this.printRoutes()
  }

  async start() {
    console.log('Starting OpenAPI server...')
    const { code, data, msg } = await API.base.userGetUserApiList()
    console.log('userGetUserApiList:', code, data, msg)
    if (code === 0) {
      if (data.open) {
        await this.stop()

        this.#server = this.app.listen(data.port, '0.0.0.0', (error: any) => {
          if (error) {
            console.error('OpenAPI server start error:', error)
            store.apiPort = -1
          }
          else {
            const port = this.app.get('port') || (this.#server?.address() as any)?.port
            if (port) {
              store.apiPort = port
            }
            console.log(`OpenAPI server is running on ${port}`)
          }
        })
        store.apiKey = data.apiKey
      }
      else {
        store.apiPort = -1
        console.log('OpenAPI server is not open')
      }
    }
    else {
      console.log('OpenAPI server failed to start:', msg)
    }
  }

  async stop() {
    const { promise, resolve } = Promise.withResolvers<void>()

    setTimeout(() => {
      resolve()
    }, 2000)

    console.log('Stopping OpenAPI server...')
    if (this.#server) {
      this.#server?.closeAllConnections()
      this.#server?.close((err) => {
        if (err) {
          console.error('OpenAPI server stop error:', err)
        }
        console.log('OpenAPI server stopped')
        this.#server = null
        resolve()
      })
    }
    else {
      resolve()
    }
    await promise
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
}()
