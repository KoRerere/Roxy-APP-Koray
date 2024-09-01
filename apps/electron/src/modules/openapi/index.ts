import { join } from 'node:path'
import express from 'express'
import { isPackaged } from '/@/utils'

import indexRouter from './routes/index'
import usersRouter from './routes/users'

class OpenAPIServer {
  private app: express.Application

  constructor() {
    this.app = express()
    this.init()
  }

  private init() {
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

    // this.app.use('/', indexRouter)
    this.app.use('/users', usersRouter)

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
}

export const openAPIServer = new OpenAPIServer()
