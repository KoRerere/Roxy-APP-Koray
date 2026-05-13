/**
 * Self-destroying Service Worker
 * ------------------------------------------------------------------
 * 本项目历史上曾通过 vite-plugin-pwa 注册了一个名为 `sw.js` 的 Service Worker，
 * 用于离线缓存 + 资源预缓存。当前已切换到纯 HTTP 缓存方案，不再需要 SW，
 * 但浏览器一旦注册过 SW 就会持续生效，必须显式注销 + 清缓存。
 *
 * 这个文件就是「注销 + 清缓存」的兜底脚本，部署后旧用户访问站点时浏览器
 * 会自动获取此 sw.js（因 SW 注册关系仍在），触发以下流程：
 *   1. install 阶段调用 skipWaiting，立即接管旧 SW
 *   2. activate 阶段：
 *      - 清空所有 caches.* 存储项（移除旧版本预缓存）
 *      - 调用 registration.unregister() 解除 SW 注册
 *      - 让所有已打开的窗口重新导航一次（脱离 SW 控制，下次起走纯 HTTP）
 *
 * ⚠️ 重要：这个文件 **必须长期保留** 在 public/ 下，不能删，也不能改名，
 *    路径必须保持 `/sw.js`（与历史 SW 同名同 scope），否则浏览器无法用它替换旧 SW。
 *
 * 参考：https://vite-pwa-org.netlify.app/guide/unregister-service-worker.html
 */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map(name => caches.delete(name)))
      }
      catch (e) {
        // 清缓存失败不应阻塞注销
      }

      try {
        await self.registration.unregister()
      }
      catch (e) {
        // 注销失败也直接放弃，浏览器下次仍会重试
      }

      try {
        const clients = await self.clients.matchAll({ type: 'window' })
        for (const client of clients) {
          if ('navigate' in client) {
            client.navigate(client.url)
          }
        }
      }
      catch (e) {
        // 已打开窗口刷新失败不影响下次冷启动
      }
    })(),
  )
})

self.addEventListener('fetch', () => {
  // 注销期间不拦截任何请求，全部交给浏览器走网络（与最终的纯 HTTP 缓存方案保持一致）
})
