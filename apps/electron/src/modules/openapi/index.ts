import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import express from 'express'
import { getPortPromise } from 'portfinder'
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

        try {
          const port = await getPortPromise({ port: data.port })
          const actualPort = await this.listen(port)
          store.apiPort = actualPort
          store.apiKey = data.apiKey
          console.log(`OpenAPI server is running on ${actualPort}`)

          if (actualPort !== data.port) {
            console.warn(`OpenAPI port ${data.port} is occupied, switched to ${actualPort}`)
            const result = await API.base.userSetUserApiCreate({ ...data, port: actualPort })
            if (result.code !== 0) {
              console.error('OpenAPI server failed to save fallback port:', result.msg)
            }
          }
        }
        catch (error) {
          console.error('OpenAPI server start error:', error)
          store.apiPort = -1
        }
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

  private async listen(port: number) {
    return new Promise<number>((resolve, reject) => {
      const server = this.app.listen(port, '0.0.0.0')
      this.#server = server

      server.once('error', (error) => {
        if (this.#server === server)
          this.#server = null
        reject(error)
      })

      server.once('listening', () => {
        const address = server.address()
        resolve(typeof address === 'object' && address ? (address as AddressInfo).port : port)
      })
    })
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
