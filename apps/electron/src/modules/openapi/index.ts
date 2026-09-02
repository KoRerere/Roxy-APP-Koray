import type { Server } from 'node:http'
import express from 'express'
import { API } from '/@/api'
import { store } from '/@/modules/store'
import { setupMiddlewares } from './middlewares/'
import { setupRoutes } from './routes/'
import { listenOnPort } from './server'

export type OpenAPIServerStartReason = 'disabled' | 'port_occupied' | 'error'

export interface OpenAPIServerStartResult {
  success: boolean
  reason?: OpenAPIServerStartReason
  port?: number
}

export class OpenAPIServer {
  #server: Server | null = null

  constructor(private app = express()) {
    // 注册中间件
    setupMiddlewares(this.app)
    // 注册路由
    setupRoutes(this.app)
    // 打印已注册的路由
    // this.printRoutes()
  }

  async start(): Promise<OpenAPIServerStartResult> {
    console.log('Starting OpenAPI server...')
    const { code, data, msg } = await API.base.userGetUserApiList()
    console.log('userGetUserApiList:', code, data, msg)
    if (code === 0) {
      if (data.open) {
        await this.stop()

        try {
          const actualPort = await this.listen(data.port)
          store.apiPort = actualPort
          store.apiKey = data.apiKey
          console.log(`OpenAPI server is running on ${actualPort}`)
          return { success: true, port: actualPort }
        }
        catch (error) {
          console.error('OpenAPI server start error:', error)
          store.apiPort = -1
          const reason = error instanceof Error && 'code' in error && error.code === 'EADDRINUSE'
            ? 'port_occupied'
            : 'error'
          return { success: false, reason, port: data.port }
        }
      }
      else {
        store.apiPort = -1
        console.log('OpenAPI server is not open')
        return { success: false, reason: 'disabled', port: data.port }
      }
    }
    else {
      console.log('OpenAPI server failed to start:', msg)
      store.apiPort = -1
      return { success: false, reason: 'error' }
    }

    return { success: false, reason: 'error' }
  }

  async ensureStarted(): Promise<OpenAPIServerStartResult> {
    const { code, data, msg } = await API.base.userGetUserApiList()
    if (code !== 0) {
      console.log('OpenAPI server health check failed:', msg)
      store.apiPort = -1
      return { success: false, reason: 'error' }
    }

    if (!data.open) {
      store.apiPort = -1
      return { success: false, reason: 'disabled', port: data.port }
    }

    if (this.#server?.listening && store.apiPort === data.port) {
      store.apiKey = data.apiKey
      return { success: true, port: data.port }
    }

    return this.start()
  }

  private async listen(port: number) {
    return listenOnPort(this.app, port, (server) => {
      this.#server = server
    }).catch((error) => {
      if (this.#server) {
        this.#server = null
      }
      throw error
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
}

export const openAPIServer = new OpenAPIServer()
