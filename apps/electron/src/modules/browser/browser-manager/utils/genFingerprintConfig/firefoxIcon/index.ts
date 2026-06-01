import { access, mkdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { appConfig } from '/@/constants'
import { renderBadgedIco } from './render'

/** 资源版本号：每次升级 logo 资源或视觉规范时 +1，旧 ico 自然失效 */
const ASSET_VERSION = 'v1'

/** 基础图标路径（设计师提供的模板，生成时以此为基底叠加徽章） */
const BASE_ICON = join(appConfig.staticResourceDir, 'firefox', 'icon.ico')

/** 兜底静态图标（生成失败或编号无效时使用） */
const FALLBACK_ICON = BASE_ICON

/** 内存级并发去重：同一 windowSortNum 同时被多次请求时只生成一次 */
const inflight = new Map<string, Promise<string>>()

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  }
  catch {
    return false
  }
}

let cacheDirReady = false
async function ensureCacheDir() {
  if (cacheDirReady)
    return
  await mkdir(appConfig.firefoxIconsCacheDir, { recursive: true })
  cacheDirReady = true
}

/**
 * 根据 windowSortNum 动态生成（或读取缓存的）Firefox 内核应用图标 .ico
 *
 * 双层缓存：
 * - 磁盘缓存：`{firefoxIconsCacheDir}/{ASSET_VERSION}_{num}.ico`，命中直接返回
 * - 内存 inflight：单进程并发同号请求合并为一次 IO
 *
 * 失败回退：捕获异常后回退到 BASE_ICON，保证 Firefox 启动链路不被中断
 */
export async function ensureFirefoxIcon(windowSortNum?: number | null): Promise<string> {
  if (!Number.isFinite(windowSortNum as number) || (windowSortNum as number) <= 0) {
    return FALLBACK_ICON
  }

  const num = Math.floor(windowSortNum as number)
  const key = `${ASSET_VERSION}_${num}`
  const cachePath = join(appConfig.firefoxIconsCacheDir, `${key}.ico`)

  if (await pathExists(cachePath))
    return cachePath

  const cached = inflight.get(key)
  if (cached)
    return cached

  const task = (async () => {
    await ensureCacheDir()
    const buf = await renderBadgedIco(BASE_ICON, num)
    // 先写 .tmp 再 rename，保证落盘原子性，避免并发读到半成品
    const tmp = `${cachePath}.tmp`
    await writeFile(tmp, buf)
    await rename(tmp, cachePath)
    return cachePath
  })()
    .catch((err) => {
      console.error('[firefoxIcon] 生成动态图标失败，回退默认 ico', err)
      return FALLBACK_ICON
    })
    .finally(() => inflight.delete(key))

  inflight.set(key, task)
  return task
}
