import type { Express, Request, Response } from 'express'
import cors from 'cors'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { env } from '../config'
import chatRoutes, { initChatRouteDirs } from './chatRoutes'
import mcpRoutes from './mcpRoutes'
import modelRoutes from './modelRoutes'
import skillRoutes from './skillRoutes'

/**
 * 创建并返回配置好的 Express 应用实例（含所有路由和中间件）。
 * 所有目录初始化副作用在此函数内完成，模块 import 时不产生任何副作用。
 */
export function createApp(): Express {
  const staticDir = path.join(env.CHECKPOINT_DIR, 'static')
  if (!fs.existsSync(staticDir)) {
    fs.mkdirSync(staticDir, { recursive: true })
  }

  // 初始化 chatRoutes 所需目录（sse、uploads）
  initChatRouteDirs()

  const app = express()

  // Middleware
  app.use(cors())
  app.use(express.json({ limit: '10mb' }))

  // Chat API routes (must be before static files)
  app.use('/api', chatRoutes)

  // MCP management routes
  app.use('/api/mcp', mcpRoutes)

  // User model routes
  app.use('/api/model', modelRoutes)

  // Skill management routes
  app.use('/api/skills', skillRoutes)

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

  return app
}

/**
 * 启动 HTTP 服务器（agent 模式专用）。
 * 不再包含任何 IM 初始化逻辑——IM 由 im 模式独立启动。
 */
export async function startServer(): Promise<void> {
  const app = createApp()
  return new Promise((resolve, reject) => {
    app.listen(env.ROXY_SERVER_PORT, (error?: Error) => {
      if (error) {
        console.error(error)
        reject(error)
      }
      else {
        console.log(`🚀 API Server running on http://localhost:${env.ROXY_SERVER_PORT}`)
        resolve()
      }
    })
  })
}
