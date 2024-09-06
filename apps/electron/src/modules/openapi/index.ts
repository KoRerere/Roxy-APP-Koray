import { join } from 'node:path'
import express from 'express'
import { isPackaged } from '/@/utils'

import indexRouter from './routes/index'
import browserRouter from './routes/browser'

class OpenAPIServer {
  private app: express.Application

  constructor() {
    this.app = express()
    this.setupRoutes()
    this.printRoutes()
  }

  private setupRoutes() {
    // 工作台
    const staticMiddleware = express.static(join(__dirname, './web'), { index: 'dashboard.html' })
    // 设置静态资源目录
    this.app.use('/dashboard', (req, res, next) => {
      const { id = '' } = req.query

      if (isPackaged) {
        staticMiddleware(req, res, next)
      }
      else {
        res.redirect(`${import.meta.env.VITE_DEV_SERVER_URL}dashboard?id=${id}`)
      }
    })

    this.app.all(`*`, async (req, res, next) => {
      // $LOG(`req header`, req.path, req.header(`token`))

      res.header('Connection', 'close')
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Headers', '*')
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PATCH, PUT, DELETE')
      res.header('Allow', 'GET, POST, PATCH, OPTIONS, PUT, DELETE')

      // if (this.intercept(req)) {
      //   return res.json({
      //     code: 500,
      //     msg: `token错误`,
      //   });
      // }
      next()
    })

    this.app.use('/api', indexRouter)
    this.app.use('/api/browser', browserRouter)

    this.app.use((req, res, next) => {
      res.status(404).send('Sorry can\'t find that!')
    })
  }

  start() {
    this.app.listen(8888, () => {
      console.log(`OpenAPI server is running on ${8888}`)
    })
  }

  stop() {
    this.app.listen().close()
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
