import axios from 'axios'
import { app } from 'electron'
import { isPackaged } from '/@/constants/common'
import { store } from '/@/modules/store'

const webDomains: string[] = JSON.parse(import.meta.env.VITE_WEB_BASE_URL || '[]')
const defaultDomain = webDomains.find(domain => domain.includes('roxybrowser.cn')) || webDomains[0]

let lastWebDomain = ''

/** 清除进程内 Web 域名缓存，供 proxy 失败后强制重新探测。 */
export function invalidateProdWebDomainCache() {
  lastWebDomain = ''
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
  if (!force && lastWebDomain) {
    return lastWebDomain
  }

  if (store.lastSelectedNetworkNode !== 'auto' && store.lastSelectedNetworkNode?.site) {
    lastWebDomain = `https://${store.lastSelectedNetworkNode.site}`
    store.lastWebDomain = lastWebDomain
    return lastWebDomain
  }

  if (store.lastWebDomain) {
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

  const attempts = webDomains.map(async (domain) => {
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
    lastWebDomain = defaultDomain
    store.lastWebDomain = lastWebDomain
    return lastWebDomain
  }
}
