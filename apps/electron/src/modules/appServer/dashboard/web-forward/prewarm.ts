import { Buffer } from 'node:buffer'
import { isPackaged } from '/@/constants/common'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import { request } from '/@/utils'
import {
  createWebCacheFileName,
  persistWebCacheIndex,
  readCachedWebResourceBody,
  setCachedWebResource,
  webResourceCache,
} from './cache'
import {
  getStringHeaderValue,
  getWebCacheKey,
  getWebResourceExpiresAt,
  isImmutableAssetRequest,
  normalizeCachedHeaders,
  shouldStoreWebResource,
} from './policy'

/** 预热入口 HTML 路径（同时兼容根路径和 index.html）。 */
const PREWARM_ENTRY_PATHS = ['/index.html', '/'] as const
/** 并发拉取 /assets/* 的最大数量，避免在启动阶段抢占带宽。 */
const PREWARM_ASSET_CONCURRENCY = 6
/** 整个预热阶段最长执行时间，超时则放弃，等待用户实际请求时再走代理。 */
const PREWARM_TOTAL_TIMEOUT_MS = 30_000
/** 单个资源的请求超时，足够覆盖打包态下的跨地域下载，又不会卡住整个流程。 */
const PREWARM_REQUEST_TIMEOUT_MS = 15_000

/** 标记该次拉取任务已被打断，超时后所有 in-flight 任务尽快返回。 */
let prewarmAbortedAt = 0
let prewarmInProgress: Promise<void> | null = null

/** 把 axios 的 IncomingHeaders 收敛成 proxyRes.headers 兼容的形态。 */
function asProxyHeaders(headers: Record<string, any>) {
  const result: Record<string, string | string[] | undefined> = {}
  Object.entries(headers || {}).forEach(([key, value]) => {
    result[key.toLowerCase()] = value as any
  })
  return result
}

/** 拉取上游资源并按和代理一致的规则写入本地缓存，命中协商缓存时只刷新过期时间。 */
async function fetchAndCacheUpstream(reqPath: string) {
  if (prewarmAbortedAt) {
    return null
  }

  const cacheKey = getWebCacheKey({ method: 'GET', url: reqPath })
  const existing = webResourceCache.get(cacheKey)

  // 不可变资源（带 hash）只要本地副本仍在 TTL 内就不必再回源，避免每次启动都全量下载。
  if (existing?.expiresAt && existing.expiresAt > Date.now() && isImmutableAssetRequest({ url: reqPath })) {
    return null
  }

  const upstreamUrl = await getWebEntryUrl(reqPath.replace(/^\//, ''))
  const conditionalHeaders: Record<string, string> = {}
  if (existing?.etag) {
    conditionalHeaders['if-none-match'] = existing.etag
  }
  if (existing?.lastModified) {
    conditionalHeaders['if-modified-since'] = existing.lastModified
  }

  const response = await request.get<ArrayBuffer>(upstreamUrl, {
    responseType: 'arraybuffer',
    timeout: PREWARM_REQUEST_TIMEOUT_MS,
    headers: conditionalHeaders,
    /** 304 同样视为成功，便于直接复用本地正文。 */
    validateStatus: status => status === 200 || status === 304,
  })

  const updatedAt = Date.now()
  const proxyHeaders = asProxyHeaders(response.headers as Record<string, any>)

  if (response.status === 304) {
    if (!existing) {
      return null
    }
    // 上游确认未变更，仅刷新本地的 TTL 元数据，避免反复回源验证。
    existing.expiresAt = getWebResourceExpiresAt({ url: reqPath }, proxyHeaders, updatedAt)
    existing.updatedAt = updatedAt
    await persistWebCacheIndex().catch(() => {})
    // HTML 入口在 304 时返回本地缓存正文，便于上层继续解析出 /assets/* 列表。
    const cachedContentType = String(existing.headers['content-type'] || '').toLowerCase()
    if (cachedContentType.includes('text/html')) {
      return await readCachedWebResourceBody(existing).catch(() => null)
    }
    return null
  }

  let body = Buffer.from(response.data as ArrayBuffer)
  const contentType = String(proxyHeaders['content-type'] || '').toLowerCase()
  const isHtml = contentType.includes('text/html')

  if (isHtml) {
    // 与代理 proxyRes 中的标题改写保持一致，确保用户首次打开时看到的也是正确标题。
    body = Buffer.from(
      body.toString('utf8').replace(/<title>(.*?)<\/title>/, `<title>${$t('工作台')}</title>`),
      'utf8',
    )
  }

  if (!shouldStoreWebResource({ url: reqPath }, { statusCode: response.status, headers: proxyHeaders }, body)) {
    return isHtml ? body : null
  }

  await setCachedWebResource(cacheKey, {
    body,
    bodyFileName: createWebCacheFileName(cacheKey),
    headers: normalizeCachedHeaders(proxyHeaders),
    etag: getStringHeaderValue(proxyHeaders.etag),
    expiresAt: getWebResourceExpiresAt({ url: reqPath }, proxyHeaders, updatedAt),
    lastModified: getStringHeaderValue(proxyHeaders['last-modified']),
    updatedAt,
  })

  return isHtml ? body : null
}

/** 从 index.html 中提取出所有 /assets/* 资源引用，作为后续并发预热的目标列表。 */
function extractAssetPaths(html: string) {
  const assetPaths = new Set<string>()
  // 仅匹配引号内的 /assets/ 路径，规避正文中的散落字符串
  const pattern = /["'](\/assets\/[^"'?#\s]+)/g
  let match: RegExpExecArray | null = pattern.exec(html)
  while (match !== null) {
    assetPaths.add(match[1])
    match = pattern.exec(html)
  }
  return Array.from(assetPaths)
}

/**
 * 启动期预热 web 转发缓存：
 * 1) 拉取入口 HTML 并按代理规则写入缓存；
 * 2) 解析出 /assets/* 资源；
 * 3) 并发回源拉取静态资源，使用户首屏请求可以直接命中本地缓存。
 *
 * 失败/超时不会抛出异常，最坏情况退化为正常代理路径。
 */
export async function prewarmWebResourceCache() {
  // 仅在打包态需要预热：开发时 Vite 会按需提供未哈希的源文件，缓存机制并不会生效。
  if (!isPackaged) {
    return
  }

  if (prewarmInProgress) {
    return prewarmInProgress
  }

  prewarmAbortedAt = 0
  const timeoutTimer = setTimeout(() => {
    prewarmAbortedAt = Date.now()
    console.warn('[web-forward-cache] prewarm timed out')
  }, PREWARM_TOTAL_TIMEOUT_MS)

  prewarmInProgress = (async () => {
    const startedAt = Date.now()

    try {
      let htmlBody: Buffer | null = null
      // 不同环境下入口可能是 / 或 /index.html，按顺序尝试以兼容两种路径。
      for (const entryPath of PREWARM_ENTRY_PATHS) {
        if (prewarmAbortedAt) {
          return
        }
        try {
          const result = await fetchAndCacheUpstream(entryPath)
          if (result) {
            htmlBody = result
            break
          }
        }
        catch (error) {
          console.warn(`[web-forward-cache] prewarm entry ${entryPath} failed`, (error as Error)?.message)
        }
      }

      if (!htmlBody) {
        return
      }

      const assetPaths = extractAssetPaths(htmlBody.toString('utf8'))
      if (assetPaths.length === 0) {
        return
      }

      let cursor = 0
      let succeeded = 0
      const isAborted = () => Boolean(prewarmAbortedAt)
      // 简易令牌池实现并发控制，避免一次性触发大量并行下载。
      const workers = Array.from(
        { length: Math.min(PREWARM_ASSET_CONCURRENCY, assetPaths.length) },
        async () => {
          while (cursor < assetPaths.length && !isAborted()) {
            const path = assetPaths[cursor++]
            try {
              await fetchAndCacheUpstream(path)
              succeeded++
            }
            catch (error) {
              console.warn('[web-forward-cache] prewarm asset failed', path, (error as Error)?.message)
            }
          }
        },
      )

      await Promise.all(workers)

      console.log(
        `[web-forward-cache] prewarm done in ${Date.now() - startedAt}ms, assets ${succeeded}/${assetPaths.length}`,
      )
    }
    catch (error) {
      console.warn('[web-forward-cache] prewarm failed', (error as Error)?.message)
    }
    finally {
      clearTimeout(timeoutTimer)
      prewarmInProgress = null
    }
  })()

  return prewarmInProgress
}
