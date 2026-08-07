/**
 * GET 协商缓存（ETag）拦截器。
 *
 * 仅对官方模板目录的只读 GET 接口启用：缓存上次响应的 ETag 与 body，下次请求
 * 自动带上 If-None-Match；服务端返回 304 时复用本地 body，对上层调用完全透明
 * （status 归一为 200）。
 *
 * 必要性：axios 默认不处理 ETag/304，浏览器对带鉴权 header（token/Authorization）
 * 的请求也不会自动复用磁盘缓存，因此必须在前端调用层显式实现协商逻辑，服务端
 * 发出的 ETag 才能真正生效。
 *
 * 注册顺序约定：在业务拦截器之前 installEtagCache。axios 的 request 拦截器按
 * 逆序执行（业务先跑）、response 拦截器按顺序执行（ETag 先跑），从而 304 在业务
 * 拦截器看到之前就被归一为 200 + 本地 body。
 */

import type {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'

// 可协商缓存的 GET 路径（roxy-agent-server 官方模板目录）
const ETAG_PATH_PATTERNS: RegExp[] = [
  /\/v1\/template-label-categories$/,
  /\/v1\/template-labels$/,
  /\/v1\/templates$/,
  /\/v1\/templates\/[^/]+$/,
]

interface CacheEntry {
  etag: string
  data: unknown
}

// 会话级内存缓存；条目很少（4 个接口 × 少量参数组合），无需 LRU 或持久化
const cache = new Map<string, CacheEntry>()

function isCacheable(url: string | undefined): boolean {
  return !!url && ETAG_PATH_PATTERNS.some(re => re.test(url))
}

function keyOf(url: string, params: unknown): string {
  return `${url}|${params ? JSON.stringify(params) : ''}`
}

export function installEtagCache(instance: AxiosInstance): void {
  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    if (!isCacheable(config.url))
      return config
    const entry = cache.get(keyOf(config.url || '', config.params))
    if (entry)
      config.headers['If-None-Match'] = entry.etag
    // 接受 304 为成功状态，避免被 axios 当错误抛出
    config.validateStatus = (status: number) =>
      (status >= 200 && status < 300) || status === 304
    return config
  })

  instance.interceptors.response.use((response: AxiosResponse) => {
    const { url, params } = response.config
    if (!isCacheable(url))
      return response
    const key = keyOf(url || '', params)
    if (response.status === 304) {
      const entry = cache.get(key)
      if (entry) {
        response.data = entry.data
        response.status = 200
      }
      return response
    }
    const etag = response.headers?.['etag']
    if (etag)
      cache.set(key, { etag, data: response.data })
    return response
  })
}
