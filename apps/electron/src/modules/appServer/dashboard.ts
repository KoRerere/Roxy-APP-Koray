import type express from 'express'
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware'
import twoFactor from 'node-2fa'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { appConfig } from '/@/constants'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import { browserManager } from '/@/modules/browser'
import { setUserConfig, store } from '/@/modules/store'
import { calculateRemainingTime, tryRefreshUrl } from '/@/utils'

interface CachedWebResource {
  /** 热路径下避免重复读盘；真正持久化的正文在 bodyFileName 对应的磁盘文件里。 */
  body?: Buffer
  /** 正文落盘文件名，和 cacheKey 解耦，避免路径过长或包含特殊字符。 */
  bodyFileName: string
  /** 透传给浏览器的缓存相关响应头。 */
  headers: Record<string, string>
  etag?: string
  lastModified?: string
  /** 本地判断是否可直接命中的过期时间；0/undefined 表示必须回源验证。 */
  expiresAt?: number
  updatedAt: number
}

const MAX_WEB_CACHE_ENTRIES = 200
const MAX_WEB_CACHE_BODY_BYTES = 5 * 1024 * 1024
// 带 hash 的静态资源可以视为不可变资源，本地直接给较长缓存时间。
const IMMUTABLE_ASSET_CACHE_TTL = 7 * 24 * 60 * 60 * 1000
const WEB_CACHE_DIR = join(appConfig.tempDir, 'web-forward-cache')
const WEB_CACHE_INDEX_FILE = join(WEB_CACHE_DIR, 'index.json')
// 进程内索引 + 热数据缓存；重启恢复时主要恢复索引，正文按需从磁盘读取。
const webResourceCache = new Map<string, CachedWebResource>()

function getWebCacheBodyPath(bodyFileName: string) {
  return join(WEB_CACHE_DIR, bodyFileName)
}

function getWebCacheKey(req: { method?: string, url?: string }) {
  return `${req.method || 'GET'}:${new URL(req.url || '/', store.lastWebDomain).toString()}`
}

function createWebCacheFileName(cacheKey: string) {
  return `${createHash('sha1').update(cacheKey).digest('hex')}.bin`
}

function isImmutableAssetRequest(req: { url?: string }) {
  const { pathname } = new URL(req.url || '/', store.lastWebDomain)
  if (!pathname.startsWith('/assets/')) {
    return false
  }

  const fileName = pathname.split('/').pop() || ''
  const extIndex = fileName.lastIndexOf('.')
  if (extIndex === -1) {
    return false
  }

  const ext = fileName.slice(extIndex + 1).toLowerCase()
  const allowedExt = new Set(['js', 'css', 'svg', 'png', 'jpg', 'jpeg', 'webp', 'woff', 'woff2', 'ttf', 'ico', 'wasm'])
  if (!allowedExt.has(ext)) {
    return false
  }

  const nameWithoutExt = fileName.slice(0, extIndex)
  const hashPart = nameWithoutExt.split('-').at(-1) || ''
  // 这里按构建产物“文件名-哈希.ext”的约定识别不可变资源，避免把普通业务接口错误纳入长缓存。
  return hashPart.length >= 8 && /^[-\w]+$/u.test(hashPart)
}

function getStringHeaderValue(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  return value
}

function normalizeCachedHeaders(headers: Record<string, string | string[] | undefined>) {
  const nextHeaders: Record<string, string> = {}

  Object.entries(headers).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase()
    if (!value || ['connection', 'content-encoding', 'content-length', 'keep-alive', 'transfer-encoding'].includes(lowerKey)) {
      return
    }

    const headerValue = getStringHeaderValue(value)
    if (!headerValue) {
      return
    }

    nextHeaders[lowerKey] = headerValue
  })

  return nextHeaders
}

function syncCachedHeaders(res: { setHeader: (name: string, value: string) => void }, headers: Record<string, string>, bodySize: number) {
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value)
  })
  res.setHeader('content-length', String(bodySize))
}

async function readCachedWebResourceBody(cacheEntry: CachedWebResource) {
  if (cacheEntry.body) {
    return cacheEntry.body
  }

  // 冷启动后索引会先恢复到内存，正文首次命中时再从磁盘回填到热缓存。
  const body = await readFile(getWebCacheBodyPath(cacheEntry.bodyFileName))
  cacheEntry.body = body
  return body
}

async function persistWebCacheIndex() {
  await mkdir(WEB_CACHE_DIR, { recursive: true })
  // index 只保存元数据，不保存正文，避免 index.json 过大且重复占用内存/磁盘。
  const serializedCache = Array.from(webResourceCache.entries()).map(([cacheKey, cacheEntry]) => {
    const { body: _body, ...rest } = cacheEntry
    return [cacheKey, rest]
  })
  await writeFile(WEB_CACHE_INDEX_FILE, JSON.stringify(serializedCache), 'utf8')
}

async function deleteCachedWebResource(cacheKey: string) {
  const cacheEntry = webResourceCache.get(cacheKey)
  if (!cacheEntry) {
    return
  }

  webResourceCache.delete(cacheKey)
  // 索引和正文文件一起删除，避免磁盘上残留孤儿缓存文件。
  await rm(getWebCacheBodyPath(cacheEntry.bodyFileName), { force: true }).catch(() => {})
  await persistWebCacheIndex().catch(() => {})
}

async function setCachedWebResource(cacheKey: string, cacheEntry: CachedWebResource) {
  if (webResourceCache.has(cacheKey)) {
    await deleteCachedWebResource(cacheKey)
  }

  webResourceCache.set(cacheKey, cacheEntry)
  await mkdir(WEB_CACHE_DIR, { recursive: true })
  await writeFile(getWebCacheBodyPath(cacheEntry.bodyFileName), cacheEntry.body!)
  await persistWebCacheIndex()

  // 用最简单的 FIFO/LRU 近似淘汰，控制内存和磁盘缓存规模。
  while (webResourceCache.size > MAX_WEB_CACHE_ENTRIES) {
    const oldestKey = webResourceCache.keys().next().value
    if (!oldestKey) {
      break
    }
    await deleteCachedWebResource(oldestKey)
  }
}

function getCacheExpiresAt(headers: Record<string, string | string[] | undefined>, updatedAt: number) {
  const cacheControl = getStringHeaderValue(headers['cache-control'])?.toLowerCase() || ''
  if (cacheControl.includes('no-cache') || cacheControl.includes('must-revalidate')) {
    return 0
  }

  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/)
  if (maxAgeMatch) {
    return updatedAt + Number(maxAgeMatch[1]) * 1000
  }

  const expiresValue = getStringHeaderValue(headers.expires)
  if (expiresValue) {
    const expiresAt = new Date(expiresValue).getTime()
    if (Number.isFinite(expiresAt)) {
      return expiresAt
    }
  }

  return 0
}

function getWebResourceExpiresAt(req: { url?: string }, headers: Record<string, string | string[] | undefined>, updatedAt: number) {
  if (isImmutableAssetRequest(req)) {
    return updatedAt + IMMUTABLE_ASSET_CACHE_TTL
  }

  // 普通资源仍尽量尊重上游缓存头，避免把 HTML/动态内容缓存得过激进。
  return getCacheExpiresAt(headers, updatedAt)
}

function shouldServeFreshCache(req: express.Request, cacheEntry: CachedWebResource) {
  if (!cacheEntry.expiresAt || cacheEntry.expiresAt <= Date.now()) {
    return false
  }

  if (isImmutableAssetRequest(req)) {
    // 浏览器刷新时常会带 no-cache；对带 hash 的静态资源，这里优先相信本地 TTL，直接命中即可。
    return true
  }

  const cacheControl = String(req.headers['cache-control'] || '').toLowerCase()
  const pragma = String(req.headers.pragma || '').toLowerCase()
  return !cacheControl.includes('no-cache') && !pragma.includes('no-cache')
}

function shouldStoreWebResource(req: { url?: string }, proxyRes: { statusCode?: number, headers: Record<string, string | string[] | undefined> }, body: Buffer) {
  if (proxyRes.statusCode !== 200 || body.length > MAX_WEB_CACHE_BODY_BYTES) {
    return false
  }

  if (isImmutableAssetRequest(req)) {
    // 带 hash 的构建产物即使上游给了 no-store，也允许本地缓存，提升打包态二次加载速度。
    return true
  }

  const cacheControl = getStringHeaderValue(proxyRes.headers['cache-control'])?.toLowerCase() || ''
  if (cacheControl.includes('no-store')) {
    return false
  }

  return Boolean(
    getStringHeaderValue(proxyRes.headers.etag)
    || getStringHeaderValue(proxyRes.headers['last-modified']),
  )
}

async function restoreWebResourceCache() {
  await mkdir(WEB_CACHE_DIR, { recursive: true })

  const cacheFileContent = await readFile(WEB_CACHE_INDEX_FILE, 'utf8').catch(() => '')
  if (!cacheFileContent) {
    return
  }

  try {
    const serializedCache = JSON.parse(cacheFileContent) as [string, CachedWebResource][]
    serializedCache.forEach(([cacheKey, cacheEntry]) => {
      if (!cacheKey || !cacheEntry?.bodyFileName) {
        return
      }
      webResourceCache.set(cacheKey, cacheEntry)
    })
  }
  catch (error) {
    console.error('[web-forward-cache] restore failed', error)
    await rm(WEB_CACHE_INDEX_FILE, { force: true }).catch(() => {})
    webResourceCache.clear()
  }
}

export async function setupDashboardServer(app: express.Application) {
  // App Server 启动时先恢复磁盘索引，确保重启后仍可复用上次下载过的静态资源。
  await restoreWebResourceCache()

  /* 获取 app 设置 */
  app.get('/api/app/config', async (req, res) => {
    const { dirId } = req.query
    const browserItem = await browserManager.getOpenedBrowser(dirId as string)

    const isIPV6 = browserItem?.winInfo.ipType === 'IPV6'

    res.success({
      appPort: store.appPort,
      language: store.language,
      ipChecker: isIPV6 ? store.lastUseIp2locationUrl : store.ipChecker,
      dashboardTourGuide: store.dashboardTourGuide,
    })
  })

  app.post('/api/dashboard/close-tour-guide', async (req, res) => {
    setUserConfig({ dashboardTourGuide: true })
    res.success({
      code: 0,
      msg: 'success',
    })
  })

  /* 代理检测 */
  app.get('/api/proxy/detection', async (req, res) => {
    const { dirId } = req.query

    if (!dirId) {
      res.error('dirId is required')
      return
    }

    const browserItem = await browserManager.getOpenedBrowser(dirId as string)

    // console.log('browserItem', browserItem)

    if (!browserItem) {
      res.error('browser not found')
      return
    }

    try {
      const proxyInfo = await browserItem.proxyDetection(true)
      res.success(proxyInfo)
    }
    catch (error) {
      res.error('proxy detection failed')
      console.log('proxyDetection error', error)
    }
  })

  /* 代理 => 刷新 URL */
  app.post('/api/proxy/refresh-url', async (req, res) => {
    const { refreshUrl } = req.body
    console.log('refreshUrl', refreshUrl)
    try {
      const result = await tryRefreshUrl(refreshUrl)
      res.success(result)
    }
    catch (error) {
      res.error('refresh url failed')
      console.log('refreshUrl error', error)
    }
  })

  /* 获取浏览器窗口列表 */
  app.get('/api/browser/list', async (req, res) => {
    const { dirId } = req.query as Record<string, any>
    try {
      const browserItem = await browserManager.getOpenedBrowser(dirId as string)
      res.success(browserItem?.winInfo)
    }
    catch (error) {
      res.error(error)
    }
  })

  /* 获取 2fa */
  app.get('/api/browser/two-factor-token', async (req, res) => {
    const { code } = req.query as Record<string, any>
    try {
      const tokenResult = twoFactor.generateToken(code)
      if (!tokenResult) {
        res.error('two factor token generate failed')
        return
      }

      const { token } = tokenResult
      const remainingTime = calculateRemainingTime()
      res.success({
        token,
        remainingTime,
      })
    }
    catch (error) {
      res.error(error)
    }
  })

  /** 获取当前内核信息 */
  app.get('/api/browser/core-info', async (req, res) => {
    console.log('/api/browser/core-info', req.query)
    const { dirId } = req.query
    const browserItem = await browserManager.getOpenedBrowser(dirId as string)
    return res.success(browserItem?.coreVersion)
  })

  const webForwardProxy = createProxyMiddleware({
    // target 留作默认/回退；实际转发地址由 router 在每次请求时解析，以便跟随 getProdWebDomain / store.lastWebDomain 更新
    target: await getWebEntryUrl(''),
    router: async () => getWebEntryUrl(''),
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
      proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
        const cacheKey = getWebCacheKey(req)
        const cacheEntry = webResourceCache.get(cacheKey)

        if (proxyRes.statusCode === 304 && cacheEntry) {
          // 上游确认资源未变更，直接用本地正文回包，避免再次下载 body。
          const cachedBody = await readCachedWebResourceBody(cacheEntry).catch(async () => {
            await deleteCachedWebResource(cacheKey)
            return null
          })
          if (!cachedBody) {
            res.setHeader('x-roxy-cache', 'MISS')
            return responseBuffer
          }

          syncCachedHeaders(res, cacheEntry.headers, cachedBody.length)
          res.statusCode = 200
          res.setHeader('x-roxy-cache', 'REVALIDATED')
          return req.method === 'HEAD' ? Buffer.alloc(0) : cachedBody
        }

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

        const requestUrl = new URL(req.url || '/', store.lastWebDomain)
        const id = requestUrl.searchParams.get('id') || ''
        await browserManager.getOpenedBrowser(id)

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
