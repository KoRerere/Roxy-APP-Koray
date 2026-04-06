import type { Request, Response } from 'express'
import cors from 'cors'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { env } from '../config'
import chatRoutes from './chatRoutes'
import { startIMServiceIfEnabled } from '../im'

const staticDir = path.join(env.CHECKPOINT_DIR!, 'static')

if (!fs.existsSync(staticDir)) {
  fs.mkdirSync(staticDir, { recursive: true })
}

const app = express()

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Chat API routes (must be before static files)
app.use('/api', chatRoutes)

// Serve static files from root directory (must be after API routes)
app.use(express.static(staticDir))

// Health check
app.get('/health', async (req: Request, res: Response) => {
  const result = await fetch(`${env.ROXY_API_HOST}/health`, {
    method: 'GET',
    headers: {
      token: env.ROXY_API_KEY!,
    },
  })
  if (result.ok) {
    res.json({ code: 0, msg: 'ok' })
  }
  else {
    res.json({ code: 1, msg: 'Health check failed', error: 'Health check failed' })
  }
})

/**
 * Start server
 */
export async function startServer() {
  // Start IM service if enabled
  console.log(`[IM] ENABLE_IM=${env.ENABLE_IM}, FEISHU_APP_ID=${env.FEISHU_APP_ID ? '***' + env.FEISHU_APP_ID.slice(-4) : 'unset'}, FEISHU_APP_SECRET=${env.FEISHU_APP_SECRET ? '***' : 'unset'}`)
  if (env.ENABLE_IM) {
    console.log('[IM] IM service enabled, starting...')
    try {
      await startIMServiceIfEnabled()
      console.log('[IM] IM service started successfully.')
    } catch (error) {
      console.error('[IM] Failed to start IM service:', error)
    }
  } else {
    console.log('[IM] IM service is disabled (ENABLE_IM is not set to true).')
  }

  app.listen(env.ROXY_SERVER_PORT, (error) => {
    if (error) {
      console.error(error)
    }
    else {
      console.log(`🚀 API Server running on http://localhost:${env.ROXY_SERVER_PORT}`)
    }
  })
}
