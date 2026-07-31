import type express from 'express'
import { isPackaged } from '/@/constants/common'
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
  // 开发态走 Vite 直通代理，不恢复/预热打包态磁盘缓存。
  if (isPackaged) {
    await restoreWebResourceCache()
  }

  await setupWebForwardProxy(app)

  if (isPackaged) {
    void prewarmWebResourceCache().catch((error) => {
      console.warn('[web-forward-cache] prewarm bootstrap failed', (error as Error)?.message)
    })
  }
}
