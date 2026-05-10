import type express from 'express'
import { registerDashboardApiRoutes } from './api-routes'
import { setupWebForward } from './web-forward'

/**
 * 装配工作台路由：
 * - 注册 /api/* 业务接口；
 * - 装配带本地缓存与启动预热的 web 转发链路。
 */
export async function setupDashboardServer(app: express.Application) {
  registerDashboardApiRoutes(app)
  await setupWebForward(app)
}
