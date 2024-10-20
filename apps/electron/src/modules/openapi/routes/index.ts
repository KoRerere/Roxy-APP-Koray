import type { Application } from 'express'
import { store } from '/@/modules/store'
import browserRouter from './browser'
import proxyRouter from './proxy'

const whiteRoutes = [
  '/health',
]

export function setupRoutes(app: Application) {
  app.all('/', async (req, res, next) => {
    // $LOG(`req header`, req.path, req.header(`token`))

    res.header('Connection', 'close')
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Headers', '*')
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PATCH, PUT, DELETE')
    res.header('Allow', 'GET, POST, PATCH, OPTIONS, PUT, DELETE')

    if (!whiteRoutes.includes(req.path) && req.header(`token`) !== store.apiKey) {
      return res.error($t('Invalid token'))
    }
    next()
  })

  app.use('/proxy', proxyRouter)
  app.use('/browser', browserRouter)

  app.use((req, res) => {
    res.status(404).send('Sorry can\'t find that!')
  })
}
