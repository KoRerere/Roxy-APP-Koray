import { createMiddleware } from 'langchain'
import { randomUUID } from 'node:crypto'
import { isAbortLike, isNetworkError } from '@/core/agentError'

export interface ModelRetryInfo {
  /** 本次重试序列的唯一标识：同一次 model 调用的多次 attempt 共享，前端据此原地更新次数而非新增消息。 */
  id: string
  /** 第几次重试，从 1 计数。 */
  attempt: number
  /** 最大重试次数。 */
  maxAttempts: number
  /** 触发重试的错误简述，仅供排查 / 日志，不作为稳定协议。 */
  reason?: string
}

export interface ModelRetryMiddlewareOptions {
  /** 最大重试次数，默认 5。 */
  maxRetries?: number
  /** 首次重试前的退避基准（毫秒），默认 500。 */
  initialDelayMs?: number
  /** 退避指数因子，默认 2。 */
  backoffFactor?: number
  /** 单次退避上限（毫秒），默认 8000。 */
  maxDelayMs?: number
  /** 是否加入抖动（50%~100%），默认 true。 */
  jitter?: boolean
  onRetry?: (info: ModelRetryInfo) => void
}

interface DelayOptions {
  initialDelayMs: number
  backoffFactor: number
  maxDelayMs: number
  jitter: boolean
}

function abortError(signal?: AbortSignal): Error {
  const err = new Error(typeof signal?.reason === 'string' ? signal.reason : 'Aborted')
  err.name = 'AbortError'
  return err
}

/** 可被 AbortSignal 提前中断的 sleep：用户取消 / 客户端断开时立即结束退避并抛 AbortError。 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal))
      return
    }

    let timer: NodeJS.Timeout
    const onAbort = () => {
      clearTimeout(timer)
      reject(abortError(signal))
    }
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** 指数退避 + 抖动：base * factor^attempt，封顶 maxDelayMs，jitter 取 50%~100% 削峰。 */
function computeDelay(attempt: number, opts: DelayOptions): number {
  const raw = opts.initialDelayMs * opts.backoffFactor ** attempt
  const capped = Math.min(raw, opts.maxDelayMs)
  if (!opts.jitter)
    return capped
  return Math.round(capped * (0.5 + Math.random() * 0.5))
}

export function createModelRetryMiddleware(options: ModelRetryMiddlewareOptions = {}) {
  const maxRetries = options.maxRetries ?? 5
  const delayOpts: DelayOptions = {
    initialDelayMs: options.initialDelayMs ?? 500,
    backoffFactor: options.backoffFactor ?? 2,
    maxDelayMs: options.maxDelayMs ?? 8000,
    jitter: options.jitter ?? true,
  }
  const { onRetry } = options

  return createMiddleware({
    name: 'roxyModelRetry',
    wrapModelCall: async (request: any, handler: any) => {
      let lastError: unknown
      // 本次 model 调用的重试序列 id：同一次调用的多次 attempt 共享，前端据此原地更新次数而非新增消息
      let retryId: string | undefined
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await handler(request)
        }
        catch (error) {
          lastError = error
          const err = (error && typeof error === 'object') ? (error as any) : new Error(String(error))
          if (isAbortLike(err))
            throw err
          if (!isNetworkError(err))
            throw err
          if (attempt >= maxRetries)
            throw err
          if (!retryId)
            retryId = randomUUID()
          try {
            onRetry?.({
              id: retryId,
              attempt: attempt + 1,
              maxAttempts: maxRetries,
              reason: typeof err.message === 'string' ? err.message.slice(0, 120) : 'network',
            })
          }
          catch {}
          const signal = request?.runtime?.signal as AbortSignal | undefined
          const delay = computeDelay(attempt, delayOpts)
          if (delay > 0)
            await sleep(delay, signal)
        }
      }
      throw lastError
    },
  })
}
