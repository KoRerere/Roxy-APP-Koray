import type express from 'express'
import { restoreWebResourceCache } from './cache'
import { prewarmWebResourceCache } from './prewarm'
import { setupWebForwardProxy } from './proxy'

/**
 * 装配 web 转发链路：
 * 1) 启动时恢复磁盘缓存索引；
 * 2) 注册带缓存能力的反向代理；
 * 3) 后台异步预热入口 HTML 与 /assets/* 资源，不阻塞主流程。
 */
export async function setupWebForward(app: express.Application) {
  // App Server 启动时先恢复磁盘索引，确保重启后仍可复用上次下载过的静态资源。
  await restoreWebResourceCache()
  await setupWebForwardProxy(app)

  // App Server 启动后立即在后台预热入口 HTML 与 /assets/* 资源，
  // 不阻塞主流程：用户实际打开工作台时大概率可以直接从本地缓存返回首屏资源。
  void prewarmWebResourceCache().catch((error) => {
    console.warn('[web-forward-cache] prewarm bootstrap failed', (error as Error)?.message)
  })
}
