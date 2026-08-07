/**
 * `@roxybrowser/sandbox/download` — browser-backed downloads for sandbox scripts.
 *
 * Network access goes through Playwright: first the controlled browser page is
 * asked to fetch bytes in page context; if page JavaScript is blocked by CORS,
 * the module falls back to the browser context's Playwright request client.
 * The host-side module then writes bytes into the sandbox output directory.
 */

import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { join, relative, isAbsolute } from 'node:path'

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024
const HARD_MAX_BYTES = 100 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 60000

let outputDir: string | undefined

export interface DownloadPage {
  evaluate: <R, Arg>(pageFunction: (arg: Arg) => R | Promise<R>, arg: Arg) => Promise<R>
  url?: () => string
  request?: BrowserRequestContext
  context?: () => { request?: BrowserRequestContext }
}

export interface DownloadEventPage extends DownloadPage {
  waitForEvent: (event: 'download', options?: { timeout?: number }) => Promise<BrowserDownload>
}

export interface BrowserDownload {
  suggestedFilename: () => string
  saveAs: (path: string) => Promise<void>
  url?: () => string
  failure?: () => Promise<string | null>
}

export interface BrowserRequestContext {
  get: (url: string, options?: { timeout?: number, headers?: Record<string, string> }) => Promise<BrowserResponse>
}

export interface BrowserResponse {
  ok: () => boolean
  status: () => number
  headers: () => Record<string, string>
  body: () => Promise<Buffer | Uint8Array>
  url?: () => string
}

export interface SaveResourceOptions {
  /** Maximum response body size for this file. Defaults to 25 MiB. Hard cap: 100 MiB. */
  maxBytes?: number
  /** Browser-side fetch timeout. Defaults to 60 seconds. */
  timeoutMs?: number
}

export interface SaveDownloadOptions {
  /** Override the browser-suggested file name. Must be a safe single file name. */
  filename?: string
  /** Maximum saved file size. Defaults to 25 MiB. Hard cap: 100 MiB. */
  maxBytes?: number
  /** Timeout while waiting for the browser download event. Defaults to 60 seconds. */
  timeoutMs?: number
}

export interface SaveResourcesItem {
  url: string
  filename: string
  /** Per-item override for maximum response body size. */
  maxBytes?: number
  /** Per-item override for browser-side fetch timeout. */
  timeoutMs?: number
}

export interface SaveResourcesOptions {
  /** Number of resources to fetch at once. Defaults to 2. Hard cap: 8. */
  concurrency?: number
  /** Maximum response body size per file. Defaults to 25 MiB. Hard cap: 100 MiB. */
  maxBytesPerFile?: number
  /** Browser-side fetch timeout per file. Defaults to 60 seconds. */
  timeoutMs?: number
  /** Continue after individual failures. Defaults to true. */
  continueOnError?: boolean
}

export interface SavedResource {
  filename: string
  path: string
  bytes: number
  contentType: string
  url: string
}

export interface SavedResourceWithIndex extends SavedResource {
  index: number
}

export interface SaveResourceFailure {
  index: number
  url: string
  filename: string
  error: string
}

export interface SaveResourcesResult {
  total: number
  saved: SavedResourceWithIndex[]
  failed: SaveResourceFailure[]
}

export type DownloadFromPageOptions = SaveResourceOptions
export type DownloadFromPageResult = SavedResource

interface BrowserFetchResult {
  base64: string
  bytes: number
  contentType: string
  url: string
}

interface ResourceBytes {
  bytes: Buffer
  contentType: string
  url: string
  source: 'page-fetch' | 'playwright-request'
}

/**
 * Host-only setup. The sandbox runtime injects the real per-run output dir.
 * Not exposed to scripts because sandbox.ts strips `__*` exports.
 */
export function __setOutputDir(dir: string): void {
  outputDir = dir
}

function assertOutputDir(): string {
  if (!outputDir) {
    throw new Error(
      '[@roxybrowser/sandbox/download] 输出目录未设置：宿主需先调用 __setOutputDir(dir)。'
      + '（该模块需由 sandbox 运行时装配，无法脱离宿主直接运行。）',
    )
  }
  return outputDir
}

function normalizeMaxBytes(value: number | undefined): number {
  if (value === undefined)
    return DEFAULT_MAX_BYTES
  if (!Number.isFinite(value) || value <= 0)
    throw new Error('[@roxybrowser/sandbox/download] maxBytes 必须是正数')
  if (value > HARD_MAX_BYTES) {
    throw new Error(
      `[@roxybrowser/sandbox/download] maxBytes 不能超过 ${HARD_MAX_BYTES} bytes`,
    )
  }
  return Math.floor(value)
}

function normalizeTimeoutMs(value: number | undefined): number {
  if (value === undefined)
    return DEFAULT_TIMEOUT_MS
  if (!Number.isFinite(value) || value <= 0)
    throw new Error('[@roxybrowser/sandbox/download] timeoutMs 必须是正数')
  return Math.floor(value)
}

function normalizeConcurrency(value: number | undefined): number {
  if (value === undefined)
    return 2
  if (!Number.isFinite(value) || value <= 0)
    throw new Error('[@roxybrowser/sandbox/download] concurrency 必须是正数')
  return Math.min(Math.floor(value), 8)
}

function assertAllowedUrl(rawUrl: string): void {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error(`[@roxybrowser/sandbox/download] 非法 URL：${rawUrl}`)
  }

  if (!['http:', 'https:', 'data:', 'blob:'].includes(url.protocol)) {
    throw new Error(
      `[@roxybrowser/sandbox/download] 不允许的 URL 协议：${url.protocol}`,
    )
  }
}

function resolveSafeFile(filename: string): string {
  const dir = assertOutputDir()
  if (!filename)
    throw new Error('[@roxybrowser/sandbox/download] filename 必填')
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    throw new Error(
      `[@roxybrowser/sandbox/download] 非法 filename（不允许路径分隔符或 ..）：${filename}`,
    )
  }
  if (/[\u0000-\u001F\u007F]/.test(filename)) {
    throw new Error(`[@roxybrowser/sandbox/download] 非法 filename（包含控制字符）：${filename}`)
  }
  if (filename.length > 180) {
    throw new Error('[@roxybrowser/sandbox/download] filename 不能超过 180 个字符')
  }

  const target = join(dir, filename)
  const rel = relative(dir, target)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(
      `[@roxybrowser/sandbox/download] 非法 filename（不允许路径穿越）：${filename}`,
    )
  }
  return target
}

async function fetchInBrowser(page: DownloadPage, url: string, maxBytes: number, timeoutMs: number): Promise<BrowserFetchResult> {
  return page.evaluate(
    async ({ url, maxBytes, timeoutMs }) => {
      function bufferToBase64(bytes: Uint8Array): string {
        let binary = ''
        const chunkSize = 0x8000
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize)
          binary += String.fromCharCode(...chunk)
        }
        return btoa(binary)
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const resp = await fetch(url, {
          credentials: 'include',
          cache: 'force-cache',
          signal: controller.signal,
        })
        if (!resp.ok)
          throw new Error(`HTTP ${resp.status}`)

        const contentLength = resp.headers.get('content-length')
        if (contentLength && Number(contentLength) > maxBytes) {
          throw new Error(`Response too large: ${contentLength} bytes > ${maxBytes} bytes`)
        }

        if (resp.body) {
          const reader = resp.body.getReader()
          const chunks: Uint8Array[] = []
          let total = 0
          while (true) {
            const { done, value } = await reader.read()
            if (done)
              break
            if (!value)
              continue
            total += value.byteLength
            if (total > maxBytes)
              throw new Error(`Response too large: ${total} bytes > ${maxBytes} bytes`)
            chunks.push(value)
          }

          const bytes = new Uint8Array(total)
          let offset = 0
          for (const chunk of chunks) {
            bytes.set(chunk, offset)
            offset += chunk.byteLength
          }

          return {
            base64: bufferToBase64(bytes),
            bytes: total,
            contentType: resp.headers.get('content-type') ?? '',
            url: resp.url || url,
          }
        }

        const arrayBuffer = await resp.arrayBuffer()
        if (arrayBuffer.byteLength > maxBytes) {
          throw new Error(`Response too large: ${arrayBuffer.byteLength} bytes > ${maxBytes} bytes`)
        }

        return {
          base64: bufferToBase64(new Uint8Array(arrayBuffer)),
          bytes: arrayBuffer.byteLength,
          contentType: resp.headers.get('content-type') ?? '',
          url: resp.url || url,
        }
      } finally {
        clearTimeout(timer)
      }
    },
    { url, maxBytes, timeoutMs },
  )
}

function requestContextFor(page: DownloadPage): BrowserRequestContext | undefined {
  return page.request ?? page.context?.().request
}

function shouldTryRequestFallback(url: string): boolean {
  const protocol = new URL(url).protocol
  return protocol === 'http:' || protocol === 'https:'
}

async function fetchWithPlaywrightRequest(
  page: DownloadPage,
  url: string,
  maxBytes: number,
  timeoutMs: number,
): Promise<ResourceBytes> {
  const request = requestContextFor(page)
  if (!request) {
    throw new Error('Playwright request context unavailable')
  }

  const headers: Record<string, string> = {}
  const referer = page.url?.()
  if (referer)
    headers.referer = referer

  const resp = await request.get(url, { timeout: timeoutMs, headers })
  if (!resp.ok())
    throw new Error(`HTTP ${resp.status()}`)

  const contentLength = resp.headers()['content-length']
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new Error(`Response too large: ${contentLength} bytes > ${maxBytes} bytes`)
  }

  const body = Buffer.from(await resp.body())
  if (body.byteLength > maxBytes) {
    throw new Error(`Response too large: ${body.byteLength} bytes > ${maxBytes} bytes`)
  }

  return {
    bytes: body,
    contentType: resp.headers()['content-type'] ?? '',
    url: resp.url?.() ?? url,
    source: 'playwright-request',
  }
}

async function fetchResourceBytes(
  page: DownloadPage,
  url: string,
  maxBytes: number,
  timeoutMs: number,
): Promise<ResourceBytes> {
  try {
    const result = await fetchInBrowser(page, url, maxBytes, timeoutMs)
    const bytes = Buffer.from(result.base64, 'base64')
    if (bytes.byteLength !== result.bytes) {
      throw new Error(
        `[@roxybrowser/sandbox/download] 下载字节校验失败：expected=${result.bytes}, actual=${bytes.byteLength}`,
      )
    }
    return {
      bytes,
      contentType: result.contentType,
      url: result.url,
      source: 'page-fetch',
    }
  } catch (browserErr: any) {
    if (!shouldTryRequestFallback(url))
      throw browserErr

    try {
      return await fetchWithPlaywrightRequest(page, url, maxBytes, timeoutMs)
    } catch (requestErr: any) {
      const browserMsg = browserErr?.message ?? String(browserErr)
      const requestMsg = requestErr?.message ?? String(requestErr)
      throw new Error(
        `browser fetch failed (${browserMsg}); Playwright request fallback failed (${requestMsg})`,
      )
    }
  }
}

/**
 * Fetch a URL through the browser page and save it inside the sandbox output dir.
 *
 * This works in Chromium and Firefox because it does not depend on native browser
 * download events or CDP. Cross-origin resources that fail page fetch because
 * of CORS fall back to Playwright's browser-context request client.
 */
/** @deprecated Use browser APIs plus the sandboxed Node `fs` module. */
export async function saveResource(
  page: DownloadPage,
  url: string,
  filename: string,
  options: SaveResourceOptions = {},
): Promise<SavedResource> {
  assertAllowedUrl(url)
  const target = resolveSafeFile(filename)
  const maxBytes = normalizeMaxBytes(options.maxBytes)
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs)
  const result = await fetchResourceBytes(page, url, maxBytes, timeoutMs)

  if (result.bytes.byteLength > maxBytes) {
    throw new Error(
      `[@roxybrowser/sandbox/download] 下载内容超过限制：${result.bytes.byteLength} > ${maxBytes}`,
    )
  }

  await mkdir(assertOutputDir(), { recursive: true })
  await writeFile(target, result.bytes)

  return {
    filename,
    path: target,
    bytes: result.bytes.byteLength,
    contentType: result.contentType,
    url: result.url,
  }
}

/**
 * Save several browser-reachable resources as artifacts.
 *
 * Each item is fetched through the supplied browser page, not through Node. By
 * default, individual failures are collected and the batch continues.
 */
/** @deprecated Use browser APIs plus the sandboxed Node `fs` module. */
export async function saveResources(
  page: DownloadPage,
  resources: SaveResourcesItem[],
  options: SaveResourcesOptions = {},
): Promise<SaveResourcesResult> {
  const total = resources.length
  const saved: SavedResourceWithIndex[] = []
  const failed: SaveResourceFailure[] = []
  const continueOnError = options.continueOnError ?? true

  async function saveOne(item: SaveResourcesItem, index: number): Promise<void> {
    try {
      const result = await saveResource(page, item.url, item.filename, {
        maxBytes: item.maxBytes ?? options.maxBytesPerFile,
        timeoutMs: item.timeoutMs ?? options.timeoutMs,
      })
      saved.push({ ...result, index })
    } catch (e: any) {
      const failure = {
        index,
        url: item.url,
        filename: item.filename,
        error: e?.message ?? String(e),
      }
      failed.push(failure)
      if (!continueOnError)
        throw e
    }
  }

  if (!continueOnError) {
    for (let i = 0; i < resources.length; i++) {
      await saveOne(resources[i], i)
    }
  } else {
    let cursor = 0
    const concurrency = normalizeConcurrency(options.concurrency)
    const workers = Array.from({ length: Math.min(concurrency, resources.length) }, async () => {
      while (cursor < resources.length) {
        const index = cursor++
        await saveOne(resources[index], index)
      }
    })
    await Promise.all(workers)
  }

  saved.sort((a, b) => a.index - b.index)
  failed.sort((a, b) => a.index - b.index)
  return { total, saved, failed }
}

/**
 * Save a real browser download triggered by an action such as clicking an
 * "Export" or "Download" button.
 */
/** @deprecated Use browser APIs plus the sandboxed Node `fs` module. */
export async function saveDownload(
  page: DownloadEventPage,
  action: () => Promise<unknown> | unknown,
  options: SaveDownloadOptions = {},
): Promise<SavedResource> {
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs)
  const maxBytes = normalizeMaxBytes(options.maxBytes)
  const downloadPromise = page.waitForEvent('download', { timeout: timeoutMs })
  await action()
  const download = await downloadPromise
  const suggestedFilename = download.suggestedFilename()
  const filename = options.filename ?? suggestedFilename
  const target = resolveSafeFile(filename)

  await mkdir(assertOutputDir(), { recursive: true })
  await download.saveAs(target)

  const failure = await download.failure?.()
  if (failure) {
    await rm(target, { force: true }).catch(() => undefined)
    throw new Error(`[@roxybrowser/sandbox/download] 浏览器下载失败：${failure}`)
  }

  const bytes = (await stat(target)).size
  if (bytes > maxBytes) {
    await rm(target, { force: true }).catch(() => undefined)
    throw new Error(
      `[@roxybrowser/sandbox/download] 下载内容超过限制：${bytes} > ${maxBytes}`,
    )
  }

  return {
    filename,
    path: target,
    bytes,
    contentType: '',
    url: download.url?.() ?? '',
  }
}
