import './core/logger'
import dotenv from 'dotenv'

dotenv.config()

import('./server').then(({ startServer }) => {
  console.log('process.execPath: ', process.execPath)
  startServer()
})