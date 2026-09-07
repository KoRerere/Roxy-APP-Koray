import axios from 'axios'
import { app } from 'electron'
import { isPackaged } from '/@/constants/common'
import { store } from '/@/modules/store'

const webDomains: string[] = JSON.parse(import.meta.env.VITE_WEB_BASE_URL || '[]')
const defaultDomain = webDomains.find(domain => domain.includes('roxybrowser.cn')) || webDomains[0]

let lastWebDomain = ''
/** Chromium 主框架已确认加载失败的 hostname，探测与 failover 都要跳过 */
const failedWebHostnames = new Set<string>()

/** 清除进程内 Web 域名缓存，供 proxy 失败后强制重新探测。 */
export function invalidateProdWebDomainCache() {
  lastWebDomain = ''
}

/** 判断 URL/域名是否已被 Chromium 确认加载失败 */
function isFailedWebDomain(urlOrDomain: string) {
  const hostname = parseWebHostname(urlOrDomain)
  return Boolean(hostname && failedWebHostnames.has(hostname))
}

/** 记录 Chromium 加载失败的 Web 域名，避免探测与 failover 反复命中同一条 */
export function markProdWebDomainFailed(urlOrDomain: string) {
  const hostname = parseWebHostname(urlOrDomain)
  if (!hostname) {
    return
  }
  failedWebHostnames.add(hostname)
  // 清掉指向该失败域名的缓存，否则刷新/探测仍会钉死在同一条线路
  if (lastWebDomain && parseWebHostname(lastWebDomain) === hostname) {
    lastWebDomain = ''
  }
  if (store.lastWebDomain && parseWebHostname(store.lastWebDomain) === hostname) {
    store.lastWebDomain = ''
  }
}

/** 记住当前可用的 Web 源，供后续 getWebEntryUrl / 探测复用 */
export function rememberProdWebDomain(domain: string) {
  const normalized = domain.replace(/\/$/, '')
  lastWebDomain = normalized
  store.lastWebDomain = normalized
  const hostname = parseWebHostname(normalized)
  if (hostname) {
    failedWebHostnames.delete(hostname)
  }
}

/** Chromium 主框架加载失败后，返回尚未失败的其它 Web 源 */
export function getRemainingProdWebOrigins(failedUrl: string): string[] {
  markProdWebDomainFailed(failedUrl)
  return getConfiguredWebDomains().filter(domain => !isFailedWebDomain(domain))
}

/** 把失败页 URL 换到下一个 Web 源，保留 path/query/hash */
export function replaceWebOrigin(failedUrl: string, nextOrigin: string): string {
  const current = new URL(failedUrl)
  const origin = nextOrigin.includes('://') ? nextOrigin : `https://${nextOrigin}`
  return new URL(`${current.pathname}${current.search}${current.hash}`, origin).href
}

/** 返回 env 中配置的全部 Web 域名候选（去尾斜杠）。 */
export function getConfiguredWebDomains() {
  return webDomains.map(domain => domain.replace(/\/$/, ''))
}

/** 从 URL 或裸域名字符串解析 hostname，失败时返回 null */
function parseWebHostname(input: string): string | null {
  try {
    const normalized = input.includes('://') ? input : `https://${input}`
    return new URL(normalized).hostname.toLowerCase()
  }
  catch {
    return null
  }
}

/** 收集 getProdWebDomain 可能用到的全部 hostname（静态配置 + store 动态项） */
function collectTrustedWebHostnames(): Set<string> {
  const hostnames = new Set<string>()

  for (const domain of webDomains) {
    const hostname = parseWebHostname(domain)
    if (hostname) {
      hostnames.add(hostname)
    }
  }

  if (store.lastWebDomain) {
    const hostname = parseWebHostname(store.lastWebDomain)
    if (hostname) {
      hostnames.add(hostname)
    }
  }

  if (store.lastSelectedNetworkNode !== 'auto' && store.lastSelectedNetworkNode?.site) {
    const hostname = parseWebHostname(store.lastSelectedNetworkNode.site)
    if (hostname) {
      hostnames.add(hostname)
    }
  }

  if (lastWebDomain) {
    const hostname = parseWebHostname(lastWebDomain)
    if (hostname) {
      hostnames.add(hostname)
    }
  }

  // 开发态主窗口走 VITE_DEV_SERVER_URL，需一并放行
  if (!isPackaged) {
    const devServerUrl = import.meta.env.VITE_DEV_SERVER_URL?.replace(/\/$/, '')
    if (devServerUrl) {
      const hostname = parseWebHostname(devServerUrl)
      if (hostname) {
        hostnames.add(hostname)
      }
    }
    hostnames.add('localhost')
    hostnames.add('127.0.0.1')
  }

  return hostnames
}

/** 判断 hostname 是否属于 getProdWebDomain 域名池（含用户选线与缓存域名） */
export function isTrustedWebCertificateHostname(hostname: string): boolean {
  return collectTrustedWebHostnames().has(hostname.toLowerCase())
}

/**
 * 注册全局 certificate-error 处理：仅自家 web 域名忽略证书错误，对所有窗口生效。
 * 须在 app.whenReady() 之前调用。
 */
export function setupTrustedWebCertificateHandler() {
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    let hostname: string
    try {
      hostname = new URL(url).hostname
    }
    catch {
      callback(false)
      return
    }

    if (!isTrustedWebCertificateHostname(hostname)) {
      callback(false)
      return
    }

    event.preventDefault()
    callback(true)
    console.warn('[App] Ignored certificate error for trusted web domain', {
      hostname,
      url,
      error,
    })
  })
}

/** 并发测试多个域名，返回第一个可用的域名，如果都不可用，则返回 CN 的域名 */
export async function getProdWebDomain(force = false) {
  if (force) {
    // 用户手动刷新时允许重试刚才失败的域名，网络可能已经恢复
    failedWebHostnames.clear()
    lastWebDomain = ''
  }

  if (!force && lastWebDomain && !isFailedWebDomain(lastWebDomain)) {
    return lastWebDomain
  }

  if (store.lastSelectedNetworkNode !== 'auto' && store.lastSelectedNetworkNode?.site) {
    const selected = `https://${store.lastSelectedNetworkNode.site}`
    if (!isFailedWebDomain(selected)) {
      lastWebDomain = selected
      store.lastWebDomain = lastWebDomain
      return lastWebDomain
    }
    console.warn('[getProdWebDomain] selected network node site already failed, probe others', selected)
  }

  if (store.lastWebDomain && !isFailedWebDomain(store.lastWebDomain)) {
    try {
      const result = await axios.get(store.lastWebDomain, {
        // adapter: electronAdapter,
        proxy: false,
        timeout: 5000,
        validateStatus: status => status >= 200 && status < 300,
      })
      if (result.status === 200) {
        lastWebDomain = store.lastWebDomain
        return store.lastWebDomain
      }
      console.error(`${store.lastWebDomain} is not available`)
    }
    catch (error) {
      console.error(`${store.lastWebDomain} is not available`, error)
    }
  }

  const probeTargets = getConfiguredWebDomains().filter(domain => !isFailedWebDomain(domain))
  const attempts = (probeTargets.length ? probeTargets : getConfiguredWebDomains()).map(async (domain) => {
    const result = await axios.get(domain, {
      // adapter: electronAdapter,
      proxy: false,
      timeout: 5000,
      validateStatus: status => status >= 200 && status < 300,
    })
    if (result.status === 200) {
      return domain
    }
    throw new Error(`${domain} is not available`)
  })
  try {
    const result = await Promise.any(attempts)
    console.log('getProdWebDomain result', result)
    lastWebDomain = result || defaultDomain
    store.lastWebDomain = lastWebDomain
    return lastWebDomain
  }
  catch (error) {
    console.error('getProdWebDomain error', error)
    lastWebDomain = probeTargets[0] || defaultDomain
    store.lastWebDomain = lastWebDomain
    return lastWebDomain
  }
}
