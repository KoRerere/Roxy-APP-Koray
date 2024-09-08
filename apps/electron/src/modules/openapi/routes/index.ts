import type { Application } from 'express'
import browserRouter from './browser'
import proxyRouter from './proxy'

export function setupRoutes(app: Application) {
  app.use('/api/proxy', proxyRouter)
  app.use('/api/browser', browserRouter)

  app.use((req, res) => {
    res.status(404).send('Sorry can\'t find that!')
  })
}
