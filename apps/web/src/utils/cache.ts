interface CacheEntry<T> {
  value: T
  expiry: number
}

/**
 * 3 hours
 */
const CACHE_EXPIRY = 1000 * 3600 * 3

export class SimpleCache<T> {
  private static instance: SimpleCache<any>
  private cache: Map<string, CacheEntry<T>> = new Map()
  private hitCount: number = 0
  private missCount: number = 0
  private pendingRequests: Map<string, Promise<T>> = new Map()

  private constructor() {
    setInterval(() => this.cleanup(), 60000) // 每分钟清理一次
  }

  public static getInstance(): SimpleCache<any> {
    if (!SimpleCache.instance) {
      SimpleCache.instance = new SimpleCache()
    }
    return SimpleCache.instance
  }

  private generateKey(request: (params: any) => Promise<any>): string {
    const [, path, method] = request.toString().replace(/\s/g, '').match(/path:"([^"]*)".*method:"([^"]*)"/) || []
    return `${method}:${path}`
  }

  async fetch<U>(request: (params: U) => Promise<any>, params: U, ttl: number = CACHE_EXPIRY): Promise<T> {
    const key = this.generateKey(request)
    const cachedData = this.get(key)
    if (cachedData) {
      return cachedData
    }

    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!
    }

    const fetchPromise = this.fetchAndCache(() => request(params), key, ttl)
    this.pendingRequests.set(key, fetchPromise)
    return fetchPromise
  }

  async updateCacheByFetch<U>(request: (params: U) => Promise<any>, params: U, ttl: number = CACHE_EXPIRY): Promise<T> {
    const key = this.generateKey(request)
    this.delete(key)
    return this.fetch(request, params, ttl)
  }

  private async fetchAndCache(request: () => Promise<any>, key: string, ttl: number): Promise<T> {
    try {
      const promise = request()
      const data = await promise
      this.set(key, data, ttl)
      return promise
    }
    finally {
      this.pendingRequests.delete(key)
    }
  }

  private set(key: string, value: T, ttl: number) {
    const expiry = Date.now() + ttl
    this.cache.set(key, { value, expiry })
  }

  private get(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) {
      this.missCount++
      return null
    }
    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      this.missCount++
      return null
    }
    this.hitCount++
    return entry.value
  }

  claer() {
    this.cache.clear()
  }

  delete(key: string) {
    this.cache.delete(key)
  }

  getKeys(): string[] {
    return Array.from(this.cache.keys())
  }

  private cleanup() {
    const now = Date.now()
    this.cache.forEach((entry, key) => {
      if (now > entry.expiry) {
        this.cache.delete(key)
      }
    })
  }

  getStats() {
    return {
      hits: this.hitCount,
      misses: this.missCount,
      size: this.cache.size,
    }
  }
}

// 使用示例
// const cache = SimpleCache.getInstance();

// const request = params =>
//   axios.request({
//     path: `/user_record_plugin_upload`,
//     method: "GET",
//     format: "json",
//     ...params,
//   });

// cache.fetch(request, params, 5000).then(data => console.log(data)); // 第一次请求
// cache.fetch(request, params, 5000).then(data => console.log(data)); // 第二次请求返回缓存

// 支持并发，相同请求只会发送一次，其他请求返回缓存
// Promise.all([
// cache.fetch(request, params, 5000).then(data => console.log(data));
// cache.fetch(request, params, 5000).then(data => console.log(data));
// cache.fetch(request, params, 5000).then(data => console.log(data));
// cache.fetch(request, params, 5000).then(data => console.log(data));
// ])

// 更新缓存
// cache.updateCacheByFetch(request, params, 5000).then(data => console.log(data));

// 获取所有缓存键
// console.log(cache.getKeys());

// 获取缓存统计信息
// console.log(cache.getStats());
