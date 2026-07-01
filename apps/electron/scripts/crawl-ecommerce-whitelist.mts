/**
 * 电商直连白名单 URL 抓取脚本
 *
 * 通过 RoxyBrowser OpenAPI 打开多个浏览器窗口，使用 puppeteer-core + CDP
 * 访问白名单中的主站首页，通过 CDP Network 事件 + Performance API
 * 收集首页加载过程中涉及的全部域名（去重）并写入独立文件。
 *
 * 用法（需先启动 RoxyBrowser 并开启 API 服务）:
 *   cd apps/electron
 *   pnpx tsx scripts/crawl-ecommerce-whitelist.mts
 *
 * 可选环境变量 / 命令行参数:
 *   ROXY_API_HOST / --host       API 地址，默认 127.0.0.1:50000
 *   ROXY_API_TOKEN / --token     API 密钥
 *   WHITELIST_FILE / --file      白名单文件路径
 *   OUTPUT_DIR / --output        输出目录
 *   BROWSER_COUNT / --browsers   浏览器数量，默认 5
 *   TABS_PER_BROWSER / --tabs    每个浏览器并发标签数，默认 8
 *   --skip-existing              跳过已存在输出文件的域名
 *   --keep-browsers              完成后保留创建的浏览器窗口（默认删除）
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pLimit from 'p-limit'
import puppeteer, { type Browser, type HTTPRequest, type HTTPResponse, type Page } from 'puppeteer-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── 默认配置 ──────────────────────────────────────────────

const DEFAULT_WHITELIST = String.raw`c:\Users\Administrator\Documents\WXWork\1688855611801813\Cache\File\2026-06\电商直连白名单.txt`
const DEFAULT_OUTPUT = path.join(__dirname, 'output', 'ecommerce-urls')

interface ScriptConfig {
  apiHost: string
  apiToken: string
  whitelistFile: string
  outputDir: string
  browserCount: number
  tabsPerBrowser: number
  navTimeoutMs: number
  settleMs: number
  skipExisting: boolean
  keepBrowsers: boolean
}

interface RoxyResponse<T = unknown> {
  code: number
  msg: string
  data?: T
}

interface WorkspaceRow {
  id: number
  workspaceName: string
}

interface BrowserOpenData {
  ws: string
  http: string
  sortNum: number
}

interface BrowserCreateData {
  dirId: string
}

class RoxyClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  private headers() {
    return {
      'Content-Type': 'application/json',
      token: this.token,
    }
  }

  async get<T>(pathname: string, params?: Record<string, unknown>): Promise<RoxyResponse<T>> {
    const url = new URL(pathname, this.baseUrl)
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value))
        }
      }
    }
    const res = await fetch(url, { headers: this.headers() })
    return res.json() as Promise<RoxyResponse<T>>
  }

  async post<T>(pathname: string, body?: Record<string, unknown>): Promise<RoxyResponse<T>> {
    const url = new URL(pathname, this.baseUrl)
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body ?? {}),
    })
    return res.json() as Promise<RoxyResponse<T>>
  }
}

function parseArgs(argv: string[]): Partial<ScriptConfig> & { help?: boolean } {
  const result: Partial<ScriptConfig> & { help?: boolean } = {}

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--help':
      case '-h':
        result.help = true
        break
      case '--host':
        result.apiHost = argv[++i]
        break
      case '--token':
        result.apiToken = argv[++i]
        break
      case '--file':
        result.whitelistFile = argv[++i]
        break
      case '--output':
        result.outputDir = argv[++i]
        break
      case '--browsers':
        result.browserCount = Number(argv[++i])
        break
      case '--tabs':
        result.tabsPerBrowser = Number(argv[++i])
        break
      case '--skip-existing':
        result.skipExisting = true
        break
      case '--keep-browsers':
        result.keepBrowsers = true
        break
    }
  }

  return result
}

function loadConfig(): ScriptConfig {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(`用法: pnpx tsx scripts/crawl-ecommerce-whitelist.mts [选项]

选项:
  --host <host:port>     API 地址 (默认 127.0.0.1:50000)
  --token <token>        API 密钥
  --file <path>          白名单文件
  --output <dir>         输出目录
  --browsers <n>         浏览器数量 (默认 5)
  --tabs <n>             每浏览器并发标签数 (默认 8)
  --skip-existing        跳过已有输出文件的域名
  --keep-browsers        保留创建的浏览器窗口
`)
    process.exit(0)
  }

  return {
    apiHost: args.apiHost ?? process.env.ROXY_API_HOST ?? '127.0.0.1:50000',
    apiToken: args.apiToken ?? process.env.ROXY_API_TOKEN ?? 'dad1b0570ebcac40e06e54e2c566d452',
    whitelistFile: args.whitelistFile ?? process.env.WHITELIST_FILE ?? DEFAULT_WHITELIST,
    outputDir: args.outputDir ?? process.env.OUTPUT_DIR ?? DEFAULT_OUTPUT,
    browserCount: args.browserCount ?? Number(process.env.BROWSER_COUNT ?? 5),
    tabsPerBrowser: args.tabsPerBrowser ?? Number(process.env.TABS_PER_BROWSER ?? 8),
    navTimeoutMs: Number(process.env.NAV_TIMEOUT_MS ?? 90_000),
    settleMs: Number(process.env.SETTLE_MS ?? 5_000),
    skipExisting: args.skipExisting ?? false,
    keepBrowsers: args.keepBrowsers ?? false,
  }
}

function normalizeDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
}

async function readDomains(filePath: string): Promise<string[]> {
  const content = await fs.readFile(filePath, 'utf8')
  const domains = content
    .split(/\r?\n/)
    .map(normalizeDomain)
    .filter(Boolean)

  return [...new Set(domains)]
}

function hostnameFromUrl(raw: string): string | null {
  try {
    const { protocol, hostname } = new URL(raw)
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(protocol) || !hostname) {
      return null
    }
    return hostname.toLowerCase().replace(/^www\./, '')
  }
  catch {
    return null
  }
}

function addHostname(collected: Set<string>, raw: string) {
  const hostname = hostnameFromUrl(raw)
  if (hostname) {
    collected.add(hostname)
  }
}

function outputFilePath(outputDir: string, domain: string): string {
  const safeName = domain.replace(/[<>:"/\\|?*]/g, '_')
  return path.join(outputDir, `${safeName}.txt`)
}

async function scrollPage(page: Page) {
  await page.evaluate(`
    (async () => {
      await new Promise((resolve) => {
        let scrolled = 0
        const step = 600
        const timer = setInterval(() => {
          const { scrollHeight } = document.documentElement
          window.scrollBy(0, step)
          scrolled += step
          if (scrolled >= scrollHeight || scrolled >= 12000) {
            clearInterval(timer)
            window.scrollTo(0, 0)
            resolve(null)
          }
        }, 250)
      })
    })()
  `)
}

async function collectDomainsFromPage(page: Page): Promise<string[]> {
  return page.evaluate(`
    (() => {
      const domains = new Set()
      const add = (raw) => {
        try {
          const hostname = new URL(raw, location.href).hostname.toLowerCase().replace(/^www\\./, '')
          if (hostname) domains.add(hostname)
        } catch (e) {}
      }

      for (const entry of performance.getEntriesByType('resource')) add(entry.name)
      for (const entry of performance.getEntriesByType('navigation')) add(entry.name)
      if (location.href) add(location.href)

      const attrNames = ['href', 'src', 'action', 'data-src', 'data-href', 'data-url', 'poster']
      for (const el of document.querySelectorAll('*')) {
        for (const attr of attrNames) {
          const value = el.getAttribute(attr)
          if (value) add(value)
        }
      }

      return [...domains].sort()
    })()
  `) as Promise<string[]>
}

async function collectHomepageDomains(page: Page, domain: string, config: ScriptConfig): Promise<string[]> {
  const collected = new Set<string>()
  const cdp = await page.createCDPSession()

  await cdp.send('Network.enable', {
    maxTotalBufferSize: 100_000_000,
    maxResourceBufferSize: 50_000_000,
  })
  await cdp.send('Page.enable')

  const onNetworkUrl = (url?: string) => {
    if (url) {
      addHostname(collected, url)
    }
  }

  cdp.on('Network.requestWillBeSent', (event: { request: { url: string } }) => {
    onNetworkUrl(event.request.url)
  })
  cdp.on('Network.responseReceived', (event: { response: { url: string } }) => {
    onNetworkUrl(event.response.url)
  })

  const onPageRequest = (req: HTTPRequest) => addHostname(collected, req.url())
  const onPageResponse = (res: HTTPResponse) => addHostname(collected, res.url())
  page.on('request', onPageRequest)
  page.on('response', onPageResponse)

  const candidates = [`https://${domain}/`, `https://www.${domain}/`, `http://${domain}/`]
  let loaded = false
  let lastError: unknown

  for (const url of candidates) {
    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: config.navTimeoutMs,
      })
      // 尽量等到网络趋于稳定，但不因长连接站点（如 Google）而直接失败
      await page.waitForNetworkIdle({ idleTime: 1500, timeout: 30_000 }).catch(() => {})
      loaded = true
      break
    }
    catch (error) {
      lastError = error
    }
  }

  if (!loaded) {
    page.off('request', onPageRequest)
    page.off('response', onPageResponse)
    await cdp.detach()
    throw new Error(`无法加载首页: ${domain}${lastError instanceof Error ? ` (${lastError.message})` : ''}`)
  }

  // 等待异步请求 + 滚动触发懒加载
  await new Promise(resolve => setTimeout(resolve, config.settleMs))
  await scrollPage(page).catch(() => {})
  await new Promise(resolve => setTimeout(resolve, config.settleMs))

  // CDP 收集主 frame 请求；Performance API 补充 resource timing（与用户控制台方法一致）
  for (const hostname of await collectDomainsFromPage(page)) {
    collected.add(hostname)
  }

  page.off('request', onPageRequest)
  page.off('response', onPageResponse)
  await cdp.detach()

  return [...collected].sort()
}

async function scrapeDomain(
  domain: string,
  browser: Browser,
  config: ScriptConfig,
): Promise<{ domain: string, count: number, error?: string }> {
  const outFile = outputFilePath(config.outputDir, domain)

  if (config.skipExisting) {
    try {
      await fs.access(outFile)
      return { domain, count: 0 }
    }
    catch {
      // file not exists, continue
    }
  }

  const page = await browser.newPage()

  try {
    const domains = await collectHomepageDomains(page, domain, config)
    const body = [
      `# domain: ${domain}`,
      `# scraped_at: ${new Date().toISOString()}`,
      `# total: ${domains.length}`,
      '',
      ...domains,
    ].join('\n')

    await fs.writeFile(outFile, body, 'utf8')
    return { domain, count: domains.length }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const body = [
      `# domain: ${domain}`,
      `# scraped_at: ${new Date().toISOString()}`,
      `# error: ${message}`,
      '',
    ].join('\n')
    await fs.writeFile(outFile, body, 'utf8')
    return { domain, count: 0, error: message }
  }
  finally {
    await page.close().catch(() => {})
  }
}

async function createBrowser(client: RoxyClient, workspaceId: number, index: number): Promise<string> {
  const res = await client.post<BrowserCreateData>('/browser/create', {
    workspaceId,
    windowName: `whitelist-crawl-${Date.now()}-${index}`,
    proxyInfo: {
      proxyMethod: 'custom',
      proxyCategory: 'noproxy',
    },
    fingerInfo: {
      forbidImage: false,
      forbidMedia: false,
      forbidAudio: false,
      openWorkbench: 0,
      stopOpenNet: false,
    },
  })

  if (res.code !== 0 || !res.data?.dirId) {
    throw new Error(`创建浏览器失败 #${index}: ${res.msg}`)
  }

  return res.data.dirId
}

async function openBrowser(client: RoxyClient, workspaceId: number, dirId: string): Promise<string> {
  const res = await client.post<BrowserOpenData>('/browser/open', {
    workspaceId,
    dirId,
    headless: false,
  })

  if (res.code !== 0 || !res.data?.ws) {
    throw new Error(`打开浏览器失败 (${dirId}): ${res.msg}`)
  }

  return res.data.ws
}

async function closeBrowser(client: RoxyClient, dirId: string) {
  await client.post('/browser/close', { dirId })
}

async function deleteBrowser(client: RoxyClient, workspaceId: number, dirId: string) {
  await client.post('/browser/delete', { workspaceId, dirIds: [dirId] })
}

async function main() {
  const config = loadConfig()
  await fs.mkdir(config.outputDir, { recursive: true })

  console.log('配置:')
  console.log(`  API: ${config.apiHost}`)
  console.log(`  白名单: ${config.whitelistFile}`)
  console.log(`  输出目录: ${config.outputDir}`)
  console.log(`  浏览器数: ${config.browserCount}, 每浏览器并发: ${config.tabsPerBrowser}`)

  const client = new RoxyClient(`http://${config.apiHost}`, config.apiToken)

  const health = await client.get('/health')
  if (health.code !== 0) {
    throw new Error(`API 健康检查失败: ${health.msg}`)
  }
  console.log('API 健康检查通过')

  const workspaceRes = await client.get<{ rows: WorkspaceRow[] }>('/browser/workspace', {
    page_index: 1,
    page_size: 1,
  })
  if (workspaceRes.code !== 0 || !workspaceRes.data?.rows?.length) {
    throw new Error(`获取 workspace 失败: ${workspaceRes.msg}`)
  }

  const workspaceId = workspaceRes.data.rows[0].id
  console.log(`workspaceId: ${workspaceId} (${workspaceRes.data.rows[0].workspaceName})`)

  const domains = await readDomains(config.whitelistFile)
  console.log(`共 ${domains.length} 个域名待抓取`)

  const dirIds: string[] = []
  const browsers: Browser[] = []

  console.log(`正在创建并打开 ${config.browserCount} 个浏览器...`)
  for (let i = 0; i < config.browserCount; i++) {
    const dirId = await createBrowser(client, workspaceId, i + 1)
    dirIds.push(dirId)
    const ws = await openBrowser(client, workspaceId, dirId)
    const browser = await puppeteer.connect({
      browserWSEndpoint: ws,
      defaultViewport: null,
    })
    browsers.push(browser)
    console.log(`  [${i + 1}/${config.browserCount}] dirId=${dirId}`)
  }

  const limits = browsers.map(() => pLimit(config.tabsPerBrowser))
  let done = 0
  let failed = 0
  const startedAt = Date.now()

  const tasks = domains.map((domain, index) => {
    const browserIndex = index % browsers.length
    const browser = browsers[browserIndex]
    const limit = limits[browserIndex]

    return limit(async () => {
      const result = await scrapeDomain(domain, browser, config)
      done++

      if (result.error) {
        failed++
        console.log(`[${done}/${domains.length}] ✗ ${domain}: ${result.error}`)
      }
      else if (result.count === 0 && config.skipExisting) {
        console.log(`[${done}/${domains.length}] ↷ ${domain}: 已跳过`)
      }
      else {
        console.log(`[${done}/${domains.length}] ✓ ${domain}: ${result.count} 个域名`)
      }
    })
  })

  try {
    await Promise.all(tasks)
  }
  finally {
    console.log('\n正在关闭浏览器连接...')
    for (const browser of browsers) {
      await browser.disconnect().catch(() => {})
    }

    for (const dirId of dirIds) {
      await closeBrowser(client, dirId).catch(err => console.warn(`关闭 ${dirId} 失败:`, err))
    }

    if (!config.keepBrowsers) {
      console.log('正在删除临时浏览器窗口...')
      for (const dirId of dirIds) {
        await deleteBrowser(client, workspaceId, dirId).catch(err => console.warn(`删除 ${dirId} 失败:`, err))
      }
    }
    else {
      console.log('已保留浏览器窗口 (--keep-browsers)')
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`\n完成: ${domains.length} 个域名, 失败 ${failed} 个, 耗时 ${elapsed}s`)
  console.log(`输出目录: ${config.outputDir}`)
}

main().catch((error) => {
  console.error('脚本执行失败:', error)
  process.exit(1)
})
