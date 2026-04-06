import { Agent, fetch, ProxyAgent } from 'undici'

export interface ProxyConfig {
  host?: string
  port?: number
  username?: string
  password?: string
  protocol?: 'http' | 'https' | 'socks5'
}

/**
 * 自动检测系统代理配置
 */
export function detectSystemProxy(): ProxyConfig {
  const proxyConfig: ProxyConfig = {}

  // 从环境变量读取代理配置
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy

  /**
   * 过滤掉字符串 'undefined' 的值
   */
  function isValidProxyUrl(url: string | undefined): url is string {
    return url != null && url !== '' && url !== 'undefined'
  }

  if (isValidProxyUrl(httpsProxy)) {
    console.log('[Proxy] Using HTTPS_PROXY:', httpsProxy)
    try {
      const url = new URL(httpsProxy)
      proxyConfig.host = url.hostname
      proxyConfig.port = Number.parseInt(url.port)
      proxyConfig.protocol = url.protocol.slice(0, -1) as any
      if (url.username) {
        proxyConfig.username = url.username
        proxyConfig.password = url.password
      }
      console.log('[Proxy] Parsed proxy config:', proxyConfig)
    }
    catch (error) {
      console.warn('[Proxy] Invalid HTTPS_PROXY URL:', error)
    }
  }
  else if (isValidProxyUrl(httpProxy)) {
    console.log('[Proxy] Using HTTP_PROXY:', httpProxy)
    try {
      const url = new URL(httpProxy)
      proxyConfig.host = url.hostname
      proxyConfig.port = Number.parseInt(url.port)
      proxyConfig.protocol = url.protocol.slice(0, -1) as any
      if (url.username) {
        proxyConfig.username = url.username
        proxyConfig.password = url.password
      }
      console.log('[Proxy] Parsed proxy config:', proxyConfig)
    }
    catch (error) {
      console.warn('[Proxy] Invalid HTTP_PROXY URL:', error)
    }
  }
  else {
    console.log('[Proxy] No valid proxy configuration found')
  }

  return proxyConfig
}

/**
 * 创建代理客户端
 */
export function createProxyAgent(config: ProxyConfig = {}): Agent | ProxyAgent {
  const finalConfig = Object.keys(config).length > 0 ? config : detectSystemProxy()

  if (finalConfig.host && finalConfig.port) {
    try {
      const proxyUrl = new URL(
        `${finalConfig.protocol || 'http'}://${finalConfig.host}:${finalConfig.port}`,
      )

      if (finalConfig.username && finalConfig.password) {
        proxyUrl.username = encodeURIComponent(finalConfig.username)
        proxyUrl.password = encodeURIComponent(finalConfig.password)
      }

      console.log('[Proxy] Using proxy:', proxyUrl.toString().replace(/:\/\/.*@/, '://***:***@'))
      return new ProxyAgent(proxyUrl)
    }
    catch (error) {
      console.warn('[Proxy] Failed to create proxy agent:', error)
      console.log('[Proxy] Using direct connection')
      return new Agent()
    }
  }

  console.log('[Proxy] No proxy configured, using direct connection')
  return new Agent()
}

/**
 * 代理版本的 fetch 函数
 */
export async function proxyFetch(
  url: string,
  options: RequestInit & { dispatcher?: Agent | ProxyAgent } = {},
  proxyConfig?: ProxyConfig,
): Promise<Response> {
  const dispatcher = options.dispatcher || createProxyAgent(proxyConfig)

  return fetch(url, {
    ...options,
    dispatcher,
  })
}
