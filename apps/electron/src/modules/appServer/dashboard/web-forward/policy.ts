import type { CachedWebResource } from './cache'
import type express from 'express'
import type { Buffer } from 'node:buffer'
import { store } from '/@/modules/store'
import { MAX_WEB_CACHE_BODY_BYTES } from './cache'

/** 带 hash 的静态资源可以视为不可变资源，本地直接给较长缓存时间。 */
const IMMUTABLE_ASSET_CACHE_TTL = 30 * 24 * 60 * 60 * 1000

/** 标准化生成 cacheKey：method + 完整 URL，便于在代理两端复用。 */
export function getWebCacheKey(req: { method?: string, url?: string }) {
  return `${req.method || 'GET'}:${new URL(req.url || '/', store.lastWebDomain).toString()}`
}

/** 判断请求路径是否为构建产物中带 hash 的不可变静态资源。 */
export function isImmutableAssetRequest(req: { url?: string }) {
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

export function getStringHeaderValue(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  return value
}

/** 过滤掉与传输层耦合的 hop-by-hop 头，只保留可直接回放给浏览器的字段。 */
export function normalizeCachedHeaders(headers: Record<string, string | string[] | undefined>) {
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

/** 从本地缓存命中时把保存好的响应头同步给当前响应对象。 */
export function syncCachedHeaders(res: { setHeader: (name: string, value: string) => void }, headers: Record<string, string>, bodySize: number) {
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value)
  })
  res.setHeader('content-length', String(bodySize))
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

/** 计算资源在本地的过期时间：不可变资源走固定 TTL，普通资源尊重上游缓存头。 */
export function getWebResourceExpiresAt(req: { url?: string }, headers: Record<string, string | string[] | undefined>, updatedAt: number) {
  if (isImmutableAssetRequest(req)) {
    return updatedAt + IMMUTABLE_ASSET_CACHE_TTL
  }

  // 普通资源仍尽量尊重上游缓存头，避免把 HTML/动态内容缓存得过激进。
  return getCacheExpiresAt(headers, updatedAt)
}

/** 判断当前请求是否可以直接由本地新鲜缓存回包，绕过上游。 */
export function shouldServeFreshCache(req: express.Request, cacheEntry: CachedWebResource) {
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

/** 判断当前响应是否值得写入缓存：只缓存 200，且体积不超限。 */
export function shouldStoreWebResource(req: { url?: string }, proxyRes: { statusCode?: number, headers: Record<string, string | string[] | undefined> }, body: Buffer) {
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
