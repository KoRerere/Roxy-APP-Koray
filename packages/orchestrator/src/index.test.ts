import dotenv from 'dotenv'
// import { startServer } from './index'

dotenv.config()

console.log('startServer')
dotenv.config()

console.log('process.env: ', process.env)
import('./index').then(({ startServer }) => {
  startServer()
})

// startServer()
