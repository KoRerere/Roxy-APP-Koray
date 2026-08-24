import type { Express } from 'express'
import type { Server } from 'node:http'
import cors from 'cors'
import express from 'express'
import { createServer } from 'node:http'
import { AgentChannelServer } from '@/core/agent-channel/server'
import { fileManager } from '@/core/fileManager'
import { env } from './config'
import conversationRoutes from './routes/conversationRoutes'
import fileRoutes from './routes/fileRoutes'
import mcpRoutes from './routes/mcpRoutes'
import roxyClawRoutes from './routes/roxyClawRoutes'
import scriptRoutes from './routes/scriptRoutes'
import skillRoutes from './routes/skillRoutes'
import taskRoutes from './routes/taskRoutes'

/**
 * 初始化路由所需的 uploads 目录，幂等。
 * uploads 目录由 FileManager 统一管理。
 */
function initRouteDirs() {
  fileManager.ensureDir()
}

/**
 * 创建并返回配置好的 Express 应用实例（含所有路由和中间件）。
 * 所有目录初始化副作用在此函数内完成，模块 import 时不产生任何副作用。
 */
export function createApp(): Express {
  initRouteDirs()

  const app = express()

  // Middleware
  app.use(cors())
  // Uploads are sent as base64 JSON payloads; 100MB files need room for base64 overhead.
  app.use(express.json({ limit: '150mb' }))

  // Chat / 会话 / 文件 API routes
  app.use('/api', fileRoutes)
  app.use('/api', conversationRoutes)

  // MCP management routes
  app.use('/api/mcp', mcpRoutes)

  // Script metadata parsing
  app.use('/api/scripts', scriptRoutes)

  // Local Skill metadata and path helpers
  app.use('/api/skills', skillRoutes)

  // Remote task scheduling, execution and local run logs
  app.use('/api/tasks', taskRoutes)

  // RoxyClaw IM control and integration checks
  app.use('/api/roxy-claw', roxyClawRoutes)

  return app
}

let httpServer: Server | null = null
let agentChannelServer: AgentChannelServer | null = null

/**
 * 启动 HTTP 服务器。
 * RoxyClaw（IM）由 agent 模式在同一进程内按配置启动。
 */
export async function startServer(): Promise<void> {
  const app = createApp()
  return new Promise((resolve, reject) => {
    const server = createServer(app)
    const channel = new AgentChannelServer(server)
    const onError = (error: Error) => {
      console.error(error)
      void channel.close()
      reject(error)
    }
    server.listen(env.ROXY_SERVER_PORT, () => {
      server.off('error', onError)
      httpServer = server
      agentChannelServer = channel
      console.log(`🚀 API Server running on http://localhost:${env.ROXY_SERVER_PORT}`)
      resolve()
    })

    server.once('error', onError)
  })
}

export async function stopServer(): Promise<void> {
  if (!httpServer) {
    return
  }

  const server = httpServer
  httpServer = null
  const channel = agentChannelServer
  agentChannelServer = null
  await channel?.close()
  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => {
      if (error) {
        reject(error)
      }
      else {
        resolve()
      }
    })
  })
}
