import type { CachedWebResource } from './cache'
import type express from 'express'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Buffer } from 'node:buffer'
import { setTimeout as sleep } from 'node:timers/promises'
import { isPackaged } from '/@/constants/common'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import { store } from '/@/modules/store'
import { request } from '/@/utils'
import {
  getConfiguredWebDomains,
  getProdWebDomain,
  invalidateProdWebDomainCache,
} from '/@/utils/getProdWebDomain'
import {
  createWebCacheFileName,
  deleteCachedWebResource,
  readCachedWebResourceBody,
  setCachedWebResource,
  webResourceCache,
} from './cache'
import { getDevViteProxyMiddleware } from './dev-vite-proxy'
import {
  getStringHeaderValue,
  getWebCacheKey,
  getWebResourceExpiresAt,
  normalizeCachedHeaders,
  shouldServeFreshCache,
  shouldStoreWebResource,
  syncCachedHeaders,
} from './policy'

/** 两次重试之间的退避间隔。 */
const PROXY_RETRY_DELAY_MS = 300

/** 单次 upstream 拉取超时。 */
const UPSTREAM_FETCH_TIMEOUT_MS = 15_000

/** 最近一次 proxy 拉取成功的 upstream base（带尾斜杠），进程内有效。 */
let preferredUpstreamBase: string | null = null

/** 记录成功的 upstream base，并同步 store 供 prewarm / getWebEntryUrl 复用。 */
function setPreferredUpstreamBase(base: string) {
  const normalized = normalizeUpstreamBase(base)
  preferredUpstreamBase = normalized
  store.lastWebDomain = normalized.replace(/\/$/, '')
}

/** 清除 preferred 缓存，在 preferred 拉取失败时触发后续探测。 */
function clearPreferredUpstreamBase() {
  preferredUpstreamBase = null
}

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

/** 归一化 upstream base URL，确保路径拼接正确。 */
function normalizeUpstreamBase(baseUrl: string) {
  return `${baseUrl.replace(/\/$/, '')}/`
}

/** 把 axios 响应头收敛成与 proxy 缓存一致的形态。 */
function asProxyHeaders(headers: Record<string, unknown>) {
  const result: Record<string, string | string[] | undefined> = {}
  Object.entries(headers || {}).forEach(([key, value]) => {
    result[key.toLowerCase()] = value as string | string[] | undefined
  })
  return result
}

/** 向候选列表追加 upstream base（去重、归一化）。 */
function appendRetryTarget(seen: Set<string>, targets: string[], baseUrl: string) {
  const normalized = normalizeUpstreamBase(baseUrl)
  if (seen.has(normalized)) {
    return
  }
  seen.add(normalized)
  targets.push(normalized)
}

/**
 * 收集静态 upstream 候选（不 force 探测）。
 * 打包态优先 env 列表（.com 在前），再追加 getWebEntryUrl 解析结果。
 */
async function buildStaticRetryTargets() {
  const seen = new Set<string>()
  const targets: string[] = []

  if (!isPackaged) {
    appendRetryTarget(seen, targets, await getWebEntryUrl(''))
    return targets
  }

  for (const domain of getConfiguredWebDomains()) {
    appendRetryTarget(seen, targets, domain.startsWith('http') ? domain : `https://${domain}`)
  }

  appendRetryTarget(seen, targets, await getWebEntryUrl(''))
  return targets
}

/** 强制健康探测后重建候选列表，供 preferred / 静态候选全部失败时使用。 */
async function buildProbedRetryTargets() {
  invalidateProdWebDomainCache()
  await getProdWebDomain(true)
  return buildStaticRetryTargets()
}

/** 按候选列表依次拉取 upstream，成功时写入 preferred 缓存。 */
async function tryForwardWithTargets(
  req: express.Request,
  res: express.Response,
  targets: string[],
  phase: string,
) {
  for (let attempt = 0; attempt < targets.length; attempt++) {
    if (attempt > 0) {
      await sleep(PROXY_RETRY_DELAY_MS)
    }

    if (res.headersSent || res.writableEnded) {
      return true
    }

    const target = targets[attempt]
    try {
      await forwardViaUpstreamFetch(req, res, target)
      setPreferredUpstreamBase(target)
      return true
    }
    catch (error) {
      const nodeError = error as NodeJS.ErrnoException
      console.warn('[web-forward] upstream fetch failed', {
        phase,
        attempt: attempt + 1,
        total: targets.length,
        code: nodeError.code,
        message: nodeError.message,
        target,
        url: req.url,
      })

      if (res.headersSent || res.writableEnded) {
        return true
      }
    }
  }

  return false
}

/** 转义 HTML 特殊字符，避免 i18n 文案破坏页面结构。 */
function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 上游全部不可达时返回友好 502，避免请求一直 pending。 */
function sendProxyFallbackResponse(res: express.Response) {
  if (res.headersSent) {
    return
  }

  const message = escapeHtml($t('工作台加载失败，请刷新页面重试'))
  const refreshLabel = escapeHtml($t('刷新'))
  const htmlLang = store.language || 'zh-CN'
  res.status(502)
  res.setHeader('content-type', 'text/html; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(`<!DOCTYPE html><html lang="${htmlLang}"><head><meta charset="UTF-8"><title>${message}</title><style>
body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,sans-serif;color:#333;background:#fafafa}
p{margin:0 0 16px;font-size:14px;line-height:1.6;text-align:center;max-width:320px;padding:0 16px}
button{padding:8px 20px;font-size:14px;color:#fff;background:#2563eb;border:none;border-radius:6px;cursor:pointer}
button:hover{background:#1d4ed8}
</style></head><body><p>${message}</p><button type="button" onclick="location.reload()">${refreshLabel}</button></body></html>`)
}

/**
 * 直接拉取 upstream 并写回响应（可安全重试，不会复用挂死的 proxy 连接）。
 */
async function forwardViaUpstreamFetch(
  req: express.Request,
  res: express.Response,
  targetBase: string,
) {
  const requestPath = req.url || '/'
  const upstreamUrl = new URL(requestPath, normalizeUpstreamBase(targetBase)).toString()
  const cacheKey = getWebCacheKey(req)
  const cacheEntry = webResourceCache.get(cacheKey)
  const conditionalHeaders: Record<string, string> = {}

  if (cacheEntry?.etag) {
    conditionalHeaders['if-none-match'] = cacheEntry.etag
  }
  if (cacheEntry?.lastModified) {
    conditionalHeaders['if-modified-since'] = cacheEntry.lastModified
  }

  const response = await request.get<ArrayBuffer>(upstreamUrl, {
    responseType: 'arraybuffer',
    timeout: UPSTREAM_FETCH_TIMEOUT_MS,
    headers: conditionalHeaders,
    validateStatus: status => status === 200 || status === 304,
  })

  if (response.status === 304) {
    if (cacheEntry && await serveRevalidatedCache(req, res, cacheKey, cacheEntry)) {
      return
    }
    throw new Error(`Upstream returned 304 without local cache: ${upstreamUrl}`)
  }

  const proxyHeaders = asProxyHeaders(response.headers as Record<string, unknown>)
  const updatedAt = Date.now()
  let responseBody = Buffer.from(response.data as ArrayBuffer)
  const contentType = String(proxyHeaders['content-type'] || '').toLowerCase()
  const isHtml = contentType.includes('text/html')

  if (isHtml) {
    responseBody = Buffer.from(
      responseBody
        .toString('utf8')
        .replace(/<title>(.*?)<\/title>/, `<title>${$t('工作台')}</title>`),
      'utf8',
    )
  }

  if (shouldStoreWebResource(req, { statusCode: response.status, headers: proxyHeaders }, responseBody)) {
    await setCachedWebResource(cacheKey, {
      body: responseBody,
      bodyFileName: createWebCacheFileName(cacheKey),
      headers: normalizeCachedHeaders(proxyHeaders),
      etag: getStringHeaderValue(proxyHeaders.etag),
      expiresAt: getWebResourceExpiresAt(req, proxyHeaders, updatedAt),
      lastModified: getStringHeaderValue(proxyHeaders['last-modified']),
      updatedAt,
    })
  }
  else {
    await deleteCachedWebResource(cacheKey)
  }

  syncCachedHeaders(res, normalizeCachedHeaders(proxyHeaders), responseBody.length)
  res.statusCode = 200
  res.setHeader('x-roxy-cache', 'MISS')

  if (req.method === 'HEAD') {
    res.end()
    return
  }

  res.end(responseBody)
}

/**
 * 装配 web 转发链路：
 * - 本地缓存 HIT 快路径
 * - preferred 成功域名快路径（零探测）
 * - 静态候选轮换，全部失败后再 force 探测重试
 */
export async function setupWebForwardProxy(app: express.Application) {
  const devViteProxy = getDevViteProxyMiddleware()

  // 本地服务只承接 /api，请求其他路径时统一转发到 webBaseUrl。
  app.use(async (req, res, next) => {
    // 开发态 Vite HMR WebSocket 由 dev-vite-proxy 处理，避免 HTTP 代理误返回 200。
    if (!isPackaged && req.headers.upgrade?.toLowerCase() === 'websocket') {
      return
    }

    if (req.path.startsWith('/api')) {
      next()
      return
    }

    // 开发态 HTTP 直通 Vite，保留 virtual module / @fs 等路径的原始语义。
    if (devViteProxy) {
      await devViteProxy(req, res, next)
      return
    }

    if (['GET', 'HEAD'].includes(req.method || 'GET')) {
      const cacheKey = getWebCacheKey(req)
      const cacheEntry = webResourceCache.get(cacheKey)

      if (cacheEntry && shouldServeFreshCache(req, cacheEntry)) {
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

    // Phase A：命中 preferred 时直接拉取，不做域名探测。
    if (preferredUpstreamBase) {
      try {
        await forwardViaUpstreamFetch(req, res, preferredUpstreamBase)
        return
      }
      catch (error) {
        const nodeError = error as NodeJS.ErrnoException
        console.warn('[web-forward] preferred upstream failed', {
          code: nodeError.code,
          message: nodeError.message,
          target: preferredUpstreamBase,
          url: req.url,
        })
        clearPreferredUpstreamBase()
        invalidateProdWebDomainCache()

        if (res.headersSent || res.writableEnded) {
          return
        }
      }
    }

    // Phase B：静态候选（env 顺序 + getWebEntryUrl，无 force 探测）。
    const staticTargets = await buildStaticRetryTargets()
    if (await tryForwardWithTargets(req, res, staticTargets, 'static')) {
      return
    }

    // Phase C：强制探测后重试（每请求最多一次）。
    const probedTargets = await buildProbedRetryTargets()
    if (await tryForwardWithTargets(req, res, probedTargets, 'probed')) {
      return
    }

    console.error('[web-forward] all upstream fetch attempts failed', req.url)
    sendProxyFallbackResponse(res)
  })
}
