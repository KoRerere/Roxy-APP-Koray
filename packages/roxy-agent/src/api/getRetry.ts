import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'

const RETRY_COUNT_KEY = '__roxyGetRetryCount'
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])
const RETRYABLE_NETWORK_ERROR_CODES = new Set([
  'EAI_AGAIN',
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'ERR_NETWORK',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
])

interface RetryableRequestConfig extends AxiosRequestConfig {
  [RETRY_COUNT_KEY]?: number
}

export interface GetRetryOptions {
  /** 最大重试次数，不含首次请求。 */
  maxRetries?: number
  /** 首次重试前的退避基准，单位为毫秒。 */
  initialDelayMs?: number
  /** 指数退避倍率。 */
  backoffFactor?: number
  /** 单次退避上限，单位为毫秒。 */
  maxDelayMs?: number
  /** 是否将退避时间随机缩短到 50% 至 100%。 */
  jitter?: boolean
  shouldRetryResponse?: (response: AxiosResponse) => boolean
}

type ResolvedGetRetryOptions = Required<Omit<GetRetryOptions, 'shouldRetryResponse'>>

const DEFAULT_OPTIONS: ResolvedGetRetryOptions = {
  maxRetries: 2,
  initialDelayMs: 300,
  backoffFactor: 2,
  maxDelayMs: 3000,
  jitter: true,
}

function isGetRequest(config?: AxiosRequestConfig): boolean {
  const method = config?.method ?? 'get'
  return method.toUpperCase() === 'GET'
}

function isCancelled(error: unknown, config?: AxiosRequestConfig): boolean {
  if (config?.signal?.aborted) {
    return true
  }

  if (!error || typeof error !== 'object') {
    return false
  }

  const candidate = error as { code?: unknown, name?: unknown }
  return candidate.code === 'ERR_CANCELED' || candidate.name === 'CanceledError'
}

function isRetryableStatus(status: unknown): boolean {
  return typeof status === 'number' && RETRYABLE_STATUS_CODES.has(status)
}

function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const candidate = error as { response?: { status?: unknown }, code?: unknown }
  if (typeof candidate.response !== 'undefined') {
    return isRetryableStatus(candidate.response.status)
  }

  return typeof candidate.code === 'string' && RETRYABLE_NETWORK_ERROR_CODES.has(candidate.code)
}

function getRetryAfterMs(response: AxiosResponse): number | undefined {
  const value = response.headers?.['retry-after'] ?? response.headers?.['Retry-After']
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined
  }

  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000
  }

  const timestamp = Date.parse(String(value))
  if (!Number.isNaN(timestamp)) {
    return Math.max(0, timestamp - Date.now())
  }

  return undefined
}

function computeDelay(attempt: number, options: ResolvedGetRetryOptions): number {
  const exponential = Math.min(
    options.initialDelayMs * options.backoffFactor ** attempt,
    options.maxDelayMs,
  )
  if (!options.jitter) {
    return exponential
  }

  return Math.round(exponential * (0.5 + Math.random() * 0.5))
}

function createAbortError(signal: AbortSignal): Error {
  const error = new Error(typeof signal.reason === 'string' ? signal.reason : 'Request aborted')
  error.name = 'AbortError'
  return error
}

function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError(signal))
      return
    }

    let timer: NodeJS.Timeout | undefined
    const onAbort = () => {
      if (timer) {
        clearTimeout(timer)
      }
      if (signal) {
        reject(createAbortError(signal))
      }
    }

    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, delayMs)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function getRetryCount(config: AxiosRequestConfig): number {
  return (config as RetryableRequestConfig)[RETRY_COUNT_KEY] ?? 0
}

function setRetryCount(config: AxiosRequestConfig, count: number): void {
  (config as RetryableRequestConfig)[RETRY_COUNT_KEY] = count
}

async function retryRequest(
  instance: AxiosInstance,
  config: RetryableRequestConfig,
  response: AxiosResponse | undefined,
  options: ResolvedGetRetryOptions,
): Promise<AxiosResponse> {
  const attempt = getRetryCount(config)
  setRetryCount(config, attempt + 1)

  // 优先遵循服务端的限流提示，否则使用有上限的指数退避。
  const retryAfterMs = response ? getRetryAfterMs(response) : undefined
  const delayMs = Math.min(
    retryAfterMs ?? computeDelay(attempt, options),
    options.maxDelayMs,
  )
  if (delayMs > 0) {
    await waitForRetry(delayMs, config.signal as AbortSignal | undefined)
  }

  return instance.request(config)
}

/**
 * Install a bounded retry policy for idempotent GET requests on an Axios instance.
 * Non-GET requests and permanent client errors are never retried.
 */
export function installAxiosGetRetryInterceptor(
  instance: AxiosInstance,
  rawOptions: GetRetryOptions = {},
): void {
  const options: ResolvedGetRetryOptions = {
    maxRetries: rawOptions.maxRetries ?? DEFAULT_OPTIONS.maxRetries,
    initialDelayMs: rawOptions.initialDelayMs ?? DEFAULT_OPTIONS.initialDelayMs,
    backoffFactor: rawOptions.backoffFactor ?? DEFAULT_OPTIONS.backoffFactor,
    maxDelayMs: rawOptions.maxDelayMs ?? DEFAULT_OPTIONS.maxDelayMs,
    jitter: rawOptions.jitter ?? DEFAULT_OPTIONS.jitter,
  }
  const shouldRetryResponse = rawOptions.shouldRetryResponse ?? (() => false)

  instance.interceptors.response.use(
    async (response) => {
      const config = response.config as RetryableRequestConfig
      if (!isGetRequest(config) || !shouldRetryResponse(response)) {
        return response
      }

      if (getRetryCount(config) >= options.maxRetries) {
        return response
      }

      return retryRequest(instance, config, response, options)
    },
    async (error: unknown) => {
      const config = (error as { config?: RetryableRequestConfig })?.config
      if (!config || !isGetRequest(config) || isCancelled(error, config) || !isRetryableError(error)) {
        throw error
      }

      if (getRetryCount(config) >= options.maxRetries) {
        throw error
      }

      return retryRequest(instance, config, (error as { response?: AxiosResponse }).response, options)
    },
  )
}
