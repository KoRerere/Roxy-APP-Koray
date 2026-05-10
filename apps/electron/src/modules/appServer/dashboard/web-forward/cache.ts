import type { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { appConfig } from '/@/constants'

export interface CachedWebResource {
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

/** 缓存条目数量上限，触达后按 FIFO 顺序淘汰最早写入的条目。 */
const MAX_WEB_CACHE_ENTRIES = 200
/** 单个资源允许写入缓存的最大字节数，超过则不缓存避免占用过多磁盘。 */
export const MAX_WEB_CACHE_BODY_BYTES = 5 * 1024 * 1024

const WEB_CACHE_DIR = join(appConfig.sessionDir, 'web-forward-cache')
const WEB_CACHE_INDEX_FILE = join(WEB_CACHE_DIR, 'index.json')

/** 进程内索引 + 热数据缓存；重启恢复时主要恢复索引，正文按需从磁盘读取。 */
export const webResourceCache = new Map<string, CachedWebResource>()

function getWebCacheBodyPath(bodyFileName: string) {
  return join(WEB_CACHE_DIR, bodyFileName)
}

/** 由 cacheKey 派生稳定的正文文件名，避免路径中混入非法字符。 */
export function createWebCacheFileName(cacheKey: string) {
  return `${createHash('sha1').update(cacheKey).digest('hex')}.bin`
}

export async function readCachedWebResourceBody(cacheEntry: CachedWebResource) {
  if (cacheEntry.body) {
    return cacheEntry.body
  }

  // 冷启动后索引会先恢复到内存，正文首次命中时再从磁盘回填到热缓存。
  const body = await readFile(getWebCacheBodyPath(cacheEntry.bodyFileName))
  cacheEntry.body = body
  return body
}

export async function persistWebCacheIndex() {
  await mkdir(WEB_CACHE_DIR, { recursive: true })
  // index 只保存元数据，不保存正文，避免 index.json 过大且重复占用内存/磁盘。
  const serializedCache = Array.from(webResourceCache.entries()).map(([cacheKey, cacheEntry]) => {
    const { body: _body, ...rest } = cacheEntry
    return [cacheKey, rest]
  })
  await writeFile(WEB_CACHE_INDEX_FILE, JSON.stringify(serializedCache), 'utf8')
}

export async function deleteCachedWebResource(cacheKey: string) {
  const cacheEntry = webResourceCache.get(cacheKey)
  if (!cacheEntry) {
    return
  }

  webResourceCache.delete(cacheKey)
  // 索引和正文文件一起删除，避免磁盘上残留孤儿缓存文件。
  await rm(getWebCacheBodyPath(cacheEntry.bodyFileName), { force: true }).catch(() => {})
  await persistWebCacheIndex().catch(() => {})
}

export async function setCachedWebResource(cacheKey: string, cacheEntry: CachedWebResource) {
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

export async function restoreWebResourceCache() {
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
