import type express from 'express'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware'
import { Buffer } from 'node:buffer'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import {
  createWebCacheFileName,
  deleteCachedWebResource,
  readCachedWebResourceBody,
  setCachedWebResource,
  webResourceCache,
} from './cache'
import type { CachedWebResource } from './cache'
import {
  getStringHeaderValue,
  getWebCacheKey,
  getWebResourceExpiresAt,
  normalizeCachedHeaders,
  shouldServeFreshCache,
  shouldStoreWebResource,
  syncCachedHeaders,
} from './policy'

type ProxyResInterceptor = Parameters<typeof responseInterceptor>[0]

/** 304 协商命中时，用本地缓存正文回包。 */
async function serveRevalidatedCache(
  req: IncomingMessage,
  res: ServerResponse,
  cacheKey: string,
  cacheEntry: CachedWebResource,
) {
  const cachedBody = await readCachedWebResourceBody(cacheEntry).catch(async () => {
    await deleteCachedWebResource(cacheKey)
    return null
  })
  if (!cachedBody) {
    return false
  }

  syncCachedHeaders(res, cacheEntry.headers, cachedBody.length)
  res.statusCode = 200
  res.setHeader('x-roxy-cache', 'REVALIDATED')
  if (req.method === 'HEAD') {
    res.end()
  }
  else {
    res.end(cachedBody)
  }
  return true
}

/**
 * http-proxy-middleware@4.1.0+ 的 responseInterceptor 会把 304/HEAD 视为无正文响应，
 * 不再调用自定义 interceptor。这里在外层先处理 304，再委托给 responseInterceptor。
 */
function createCachedProxyResHandler(interceptor: ProxyResInterceptor) {
  const innerHandler = responseInterceptor(interceptor)

  return async (proxyRes: IncomingMessage, req: IncomingMessage, res: ServerResponse) => {
    if (proxyRes.statusCode === 304) {
      const cacheKey = getWebCacheKey(req)
      const cacheEntry = webResourceCache.get(cacheKey)
      if (cacheEntry) {
        proxyRes.resume()
        if (await serveRevalidatedCache(req, res, cacheKey, cacheEntry)) {
          return
        }
      }
    }

    return innerHandler(proxyRes, req, res)
  }
}

/**
 * 装配 web 转发代理：
 * - 在 proxyReq 阶段补充协商缓存 Header
 * - 在 proxyRes 阶段拦截响应，按规则写入本地缓存
 * - 注册 app.use 中间件实现「本地命中即返回」的快路径
 */
export async function setupWebForwardProxy(app: express.Application) {
  const webForwardProxy = createProxyMiddleware({
    // target 留作默认/回退；实际转发地址由 router 在每次请求时解析，以便跟随 getProdWebDomain / store.lastWebDomain 更新
    target: await getWebEntryUrl(''),
    router: () => getWebEntryUrl(''),
    changeOrigin: true,
    selfHandleResponse: true,
    on: {
      proxyReq(proxyReq, req) {
        if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
          return
        }

        const cacheEntry = webResourceCache.get(getWebCacheKey(req))
        if (!cacheEntry) {
          return
        }

        // 普通资源优先走协商缓存，减少重复下载；不可变资源则大多会在更前面的 HIT 分支直接返回。
        if (cacheEntry.etag && !proxyReq.getHeader('if-none-match')) {
          proxyReq.setHeader('if-none-match', cacheEntry.etag)
        }

        if (cacheEntry.lastModified && !proxyReq.getHeader('if-modified-since')) {
          proxyReq.setHeader('if-modified-since', cacheEntry.lastModified)
        }
      },
      proxyRes: createCachedProxyResHandler(async (responseBuffer, proxyRes, req, res) => {
        const cacheKey = getWebCacheKey(req)

        const contentType = proxyRes.headers['content-type']
        let responseBody = responseBuffer
        const updatedAt = Date.now()

        if (!contentType?.includes('text/html')) {
          // 非 HTML 资源直接按原始内容缓存；HTML 会在下面做标题改写后再决定是否缓存。
          if (shouldStoreWebResource(req, proxyRes, responseBody)) {
            await setCachedWebResource(cacheKey, {
              body: responseBody,
              bodyFileName: createWebCacheFileName(cacheKey),
              headers: normalizeCachedHeaders(proxyRes.headers),
              etag: getStringHeaderValue(proxyRes.headers.etag),
              expiresAt: getWebResourceExpiresAt(req, proxyRes.headers, updatedAt),
              lastModified: getStringHeaderValue(proxyRes.headers['last-modified']),
              updatedAt,
            })
          }
          else {
            await deleteCachedWebResource(cacheKey)
          }

          res.setHeader('x-roxy-cache', 'MISS')
          return req.method === 'HEAD' ? Buffer.alloc(0) : responseBody
        }

        // 勿阻塞 HTML 响应：首屏请求往往发生在 launchPromise 完成之前，
        // await getOpenedBrowser 会等待整段启动流程，导致 dashboard 一直 loading。

        // responseInterceptor 会先自动解压 gzip/br/deflate，再把这里返回的正文重新写回响应。
        responseBody = Buffer.from(
          responseBuffer
            .toString('utf8')
            .replace(/<title>(.*?)<\/title>/, `<title>${$t('工作台')}</title>`),
          'utf8',
        )

        if (shouldStoreWebResource(req, proxyRes, responseBody)) {
          await setCachedWebResource(cacheKey, {
            body: responseBody,
            bodyFileName: createWebCacheFileName(cacheKey),
            headers: normalizeCachedHeaders(proxyRes.headers),
            etag: getStringHeaderValue(proxyRes.headers.etag),
            expiresAt: getWebResourceExpiresAt(req, proxyRes.headers, updatedAt),
            lastModified: getStringHeaderValue(proxyRes.headers['last-modified']),
            updatedAt,
          })
        }
        else {
          await deleteCachedWebResource(cacheKey)
        }

        res.setHeader('x-roxy-cache', 'MISS')
        return req.method === 'HEAD' ? Buffer.alloc(0) : responseBody
      }),
    },
  })

  // 本地服务只承接 /api，请求其他路径时统一转发到 webBaseUrl。
  app.use(async (req, res, next) => {
    if (req.path.startsWith('/api')) {
      next()
      return
    }

    if (['GET', 'HEAD'].includes(req.method || 'GET')) {
      const cacheKey = getWebCacheKey(req)
      const cacheEntry = webResourceCache.get(cacheKey)

      if (cacheEntry && shouldServeFreshCache(req, cacheEntry)) {
        // 命中新鲜缓存时直接从本地返回，完全绕过上游请求。
        const cachedBody = await readCachedWebResourceBody(cacheEntry).catch(async () => {
          await deleteCachedWebResource(cacheKey)
          return null
        })

        if (cachedBody) {
          syncCachedHeaders(res, cacheEntry.headers, cachedBody.length)
          res.setHeader('x-roxy-cache', 'HIT')
          res.status(200).end(req.method === 'HEAD' ? undefined : cachedBody)
          return
        }
      }
    }

    webForwardProxy(req, res, next)
  })
}
