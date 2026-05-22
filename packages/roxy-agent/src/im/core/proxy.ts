// import { net } from 'electron'
/**
 * 优先使用 Electron 的 net.fetch（自动感知系统代理）
 */
export async function proxyFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  try {
    const { net } = await import('electron')
    // net.fetch rejects manually-set Content-Length (it computes it from the body)
    const headers = new Headers(options.headers)
    headers.delete('Content-Length')
    headers.delete('content-length')
    const netOptions = { ...options, headers }
    console.debug('[Proxy] Electron net.fetch', url, netOptions)
    const response = await net.fetch(url, netOptions)
    return response as Response
  }
  catch (error) {
    console.warn('[Proxy] Electron net.fetch failed:', error.message)
  }

  // 回退到全局 fetch
  console.info('[Proxy] Using global fetch for:', url)
  return fetch(url, options)
}
