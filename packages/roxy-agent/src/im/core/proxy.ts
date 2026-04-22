import { net } from 'electron'

/**
 * 优先使用 Electron 的 net.fetch（自动感知系统代理）
 */
export async function proxyFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  if (net && net.fetch) {
    console.log('[Proxy] Using Electron net.fetch for:', url)
    try {
      const electronOptions: any = { ...options }

      // 如果有 duplex 设置，需要保留
      if ((options as any).duplex) {
        electronOptions.duplex = (options as any).duplex
      }

      const response = await net.fetch(url, electronOptions)
      return response as Response
    }
    catch (error) {
      console.warn('[Proxy] Electron net.fetch failed:', error)
    }
  }

  // 回退到全局 fetch
  console.log('[Proxy] Using global fetch for:', url)
  return fetch(url, options)
}
