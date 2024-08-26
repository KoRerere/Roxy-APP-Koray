import express from 'express'

import indexRouter from './routes/index'
import usersRouter from './routes/users'

class OpenAPIServer {
  private app: express.Application

  constructor() {
    this.app = express()
    this.init()
  }

  private init() {
    this.app.use('/', indexRouter)
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
