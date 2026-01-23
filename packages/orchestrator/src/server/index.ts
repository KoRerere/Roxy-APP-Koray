import type { Request, Response } from 'express'
import cors from 'cors'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { env } from '../config'
import chatRoutes from './chatRoutes'

const staticDir = path.join(env.CHECKPOINT_DIR!, 'static')

if (!fs.existsSync(staticDir)) {
  fs.mkdirSync(staticDir, { recursive: true })
}

const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// Chat API routes (must be before static files)
app.use('/api', chatRoutes)

// Serve static files from root directory (must be after API routes)
app.use(express.static(staticDir))

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

/**
 * Start server
 */
export async function startServer() {
  app.listen(env.ROXY_SERVER_PORT, (error) => {
    if (error) {
      console.error(error)
    }
    else {
      console.log(`🚀 API Server running on http://localhost:${env.ROXY_SERVER_PORT}`)
    }
  })
}
