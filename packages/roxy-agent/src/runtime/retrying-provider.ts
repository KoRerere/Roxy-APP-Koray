import type {
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  IModelProvider,
  Message,
  StructuredOutputFn,
  StructuredOutputOptions,
} from 'roxy-agent-runtime'
import type { ZodType } from 'zod'
import { randomUUID } from 'node:crypto'
import { isNetworkError } from '@/core/agentError'

export const DEFAULT_RUNTIME_MAX_RETRIES = 5

export interface RuntimeRetryEvent {
  retryId: string
  attempt: number
  maxAttempts: number
  reason: string
}

export interface RuntimeNetworkRetryOptions {
  /** Number of retries after the initial model request. */
  maxRetries?: number
  /** Exponential backoff in milliseconds, or a custom delay per retry attempt. */
  delayMs?: number | ((attempt: number) => number)
  onRetry?: (event: RuntimeRetryEvent) => void
}

function retryReason(error: unknown): string {
  if (error && typeof error === 'object') {
    const value = error as { status?: unknown, code?: unknown, response?: { status?: unknown } }
    const status = value.status ?? value.response?.status
    if (typeof status === 'number') {
      return `http_${status}`
    }
    if (typeof value.code === 'string' && value.code.trim()) {
      return value.code
    }
  }
  return 'network_error'
}

function isTransientRuntimeError(error: unknown): boolean {
  if (isNetworkError(error)) {
    return true
  }

  let current: any = error
  const seen = new Set<any>()
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const rawStatus = current.status ?? current.statusCode ?? current.response?.status
    const status = typeof rawStatus === 'number'
      ? rawStatus
      : typeof rawStatus === 'string' && /^\d+$/.test(rawStatus) ? Number(rawStatus) : undefined
    if (status !== undefined && (status === 408 || status === 409 || status === 425 || status >= 500)) {
      return true
    }
    const code = typeof current.code === 'string' ? current.code : ''
    const message = typeof current.message === 'string' ? current.message : ''
    if (/^(?:server_error|internal_server_error|service_unavailable|timeout)$/i.test(code)
      || /\b(?:server_error|internal_server_error|service unavailable|timed? ?out)\b/i.test(message)) {
      return true
    }
    current = current.cause
  }
  return false
}

function delayFor(attempt: number, delayMs: RuntimeNetworkRetryOptions['delayMs']): number {
  if (typeof delayMs === 'function') {
    return Math.max(0, delayMs(attempt))
  }
  if (typeof delayMs === 'number') {
    return Math.max(0, delayMs)
  }
  return Math.min(4000, 250 * 2 ** (attempt - 1))
}

async function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (delayMs <= 0) {
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted', 'AbortError')
    }
    return
  }

  await new Promise<void>((resolve, reject) => {
    let abort: () => void
    const cleanup = () => signal?.removeEventListener('abort', abort)
    const complete = () => {
      cleanup()
      resolve()
    }
    const timer = setTimeout(complete, delayMs)
    abort = () => {
      clearTimeout(timer)
      cleanup()
      reject(new DOMException('The operation was aborted', 'AbortError'))
    }
    if (signal?.aborted) {
      abort()
      return
    }
    signal?.addEventListener('abort', abort, { once: true })
  })
}

export async function retryRuntimeOperation<T>(
  operation: () => Promise<T>,
  options: RuntimeNetworkRetryOptions = {},
  signal?: AbortSignal,
): Promise<T> {
  const maxRetries = Math.max(0, Math.floor(options.maxRetries ?? DEFAULT_RUNTIME_MAX_RETRIES))
  const retryId = randomUUID()
  let attempt = 0
  while (true) {
    try {
      return await operation()
    }
    catch (error) {
      if (signal?.aborted || attempt >= maxRetries || !isTransientRuntimeError(error)) {
        throw error
      }
      attempt++
      options.onRetry?.({
        retryId,
        attempt,
        maxAttempts: maxRetries,
        reason: retryReason(error),
      })
      await waitForRetry(delayFor(attempt, options.delayMs), signal)
    }
  }
}

/**
 * Add bounded retries around one model provider without changing runtime
 * memory semantics. A stream is retried before its response is committed to
 * memory, so the next attempt starts from the same request history.
 */
export class RuntimeNetworkRetryProvider implements IModelProvider {
  readonly id: string
  readonly contextWindowTokens: number
  private readonly maxRetries: number
  private readonly delayMs: RuntimeNetworkRetryOptions['delayMs']
  private readonly onRetry?: (event: RuntimeRetryEvent) => void

  constructor(
    private readonly provider: IModelProvider,
    options: RuntimeNetworkRetryOptions = {},
  ) {
    this.id = provider.id
    this.contextWindowTokens = provider.contextWindowTokens
    this.maxRetries = Math.max(0, Math.floor(options.maxRetries ?? DEFAULT_RUNTIME_MAX_RETRIES))
    this.delayMs = options.delayMs
    this.onRetry = options.onRetry
  }

  async invoke(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    return this.retry(() => this.provider.invoke(req, signal), signal)
  }

  async* stream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatStreamChunk> {
    const retryId = randomUUID()
    let attempt = 0
    while (true) {
      try {
        for await (const chunk of this.provider.stream(req, signal)) {
          yield chunk
        }
        return
      }
      catch (error) {
        if (signal?.aborted || attempt >= this.maxRetries || !isTransientRuntimeError(error)) {
          throw error
        }
        attempt++
        this.onRetry?.({
          retryId,
          attempt,
          maxAttempts: this.maxRetries,
          reason: retryReason(error),
        })
        await waitForRetry(delayFor(attempt, this.delayMs), signal)
      }
    }
  }

  countTokens(messages: Message[]): Promise<number> {
    return this.provider.countTokens(messages)
  }

  toProviderRequest(req: ChatRequest): unknown {
    if (!this.provider.toProviderRequest) {
      throw new Error('RuntimeNetworkRetryProvider: wrapped provider does not implement toProviderRequest')
    }
    return this.provider.toProviderRequest(req)
  }

  fromProviderResponse(response: unknown): ChatResponse {
    if (!this.provider.fromProviderResponse) {
      throw new Error('RuntimeNetworkRetryProvider: wrapped provider does not implement fromProviderResponse')
    }
    return this.provider.fromProviderResponse(response)
  }

  withStructuredOutput<T, IncludeRaw extends boolean = false>(
    schema: ZodType<T>,
    options?: StructuredOutputOptions & { includeRaw?: IncludeRaw },
  ): StructuredOutputFn<IncludeRaw extends true ? { raw: Message, parsed: T } : T> {
    const structured = this.provider.withStructuredOutput(schema, options)
    return ((input: string | Message[], signal?: AbortSignal) => this.retry(
      () => structured(input, signal),
      signal,
    )) as StructuredOutputFn<IncludeRaw extends true ? { raw: Message, parsed: T } : T>
  }

  private async retry<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    return retryRuntimeOperation(operation, {
      maxRetries: this.maxRetries,
      delayMs: this.delayMs,
      onRetry: this.onRetry,
    }, signal)
  }
}

export function withRuntimeNetworkRetry(
  provider: IModelProvider,
  options?: RuntimeNetworkRetryOptions,
): IModelProvider {
  return new RuntimeNetworkRetryProvider(provider, options)
}
