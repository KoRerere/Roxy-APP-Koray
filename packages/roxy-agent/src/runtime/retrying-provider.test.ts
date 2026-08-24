import { chatResponse, type ChatRequest, type ChatResponse, type ChatStreamChunk, type IModelProvider } from 'roxy-agent-runtime'
import { describe, expect, it, vi } from 'vitest'
import { retryRuntimeOperation, withRuntimeNetworkRetry } from './retrying-provider'

const request: ChatRequest = {
  model: 'deepseek-v4-flash',
  messages: [{ role: 'user', content: 'hello' }],
  maxTokens: 32,
}

function response(text = 'ok'): ChatResponse {
  return chatResponse({ role: 'assistant', content: text }, 'end_turn', { inputTokens: 1, outputTokens: 1 })
}

function provider(overrides: Partial<IModelProvider>): IModelProvider {
  return {
    id: 'test-provider',
    contextWindowTokens: 1000,
    invoke: vi.fn(async () => response()),
    stream: vi.fn(async function* (): AsyncIterable<ChatStreamChunk> {
      yield { type: 'message_stop', stopReason: 'end_turn', usage: { inputTokens: 1, outputTokens: 1 } }
    }),
    countTokens: vi.fn(async () => 1),
    withStructuredOutput: vi.fn(() => {
      throw new Error('unused in this test')
    }),
    ...overrides,
  }
}

describe('runtime network retry provider', () => {
  it('retries transient HTTP failures and resets the counter after success', async () => {
    // Regression: a transient 503 escaped the runtime immediately and the UI
    // only showed a terminal network error.
    // Fixed by: retrying the provider call and reporting each retry attempt.
    let calls = 0
    const onRetry = vi.fn()
    const wrapped = withRuntimeNetworkRetry(provider({
      invoke: vi.fn(async () => {
        calls++
        if (calls === 1) {
          throw Object.assign(new Error('service unavailable'), { status: 503 })
        }
        return response()
      }),
    }), { onRetry, delayMs: () => 0 })

    await expect(wrapped.invoke(request)).resolves.toEqual(response())
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ attempt: 1, maxAttempts: 5 }))
    expect(calls).toBe(2)

    await expect(wrapped.invoke(request)).resolves.toEqual(response())
    expect(calls).toBe(3)
  })

  it('does not retry non-transient request failures', async () => {
    const invoke = vi.fn(async () => {
      throw Object.assign(new Error('bad request'), { status: 400 })
    })
    const onRetry = vi.fn()
    const wrapped = withRuntimeNetworkRetry(provider({ invoke }), { onRetry, delayMs: () => 0 })

    await expect(wrapped.invoke(request)).rejects.toThrow('bad request')
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('passes optional provider conversion hooks through when available', () => {
    const req = request
    const rawRequest = { wire: 'request' }
    const rawResponse = { wire: 'response' }
    const canonical = response('converted')
    const wrapped = withRuntimeNetworkRetry(provider({
      toProviderRequest: vi.fn(() => rawRequest),
      fromProviderResponse: vi.fn(() => canonical),
    }))

    expect(wrapped.toProviderRequest?.(req)).toBe(rawRequest)
    expect(wrapped.fromProviderResponse?.(rawResponse)).toBe(canonical)
  })

  it('retries model configuration requests with Axios-style response statuses', async () => {
    let calls = 0
    const onRetry = vi.fn()
    const result = await retryRuntimeOperation(async () => {
      calls++
      if (calls === 1) {
        throw Object.assign(new Error('service unavailable'), { response: { status: 503 } })
      }
      return 'ready'
    }, { onRetry, delayMs: () => 0 })

    expect(result).toBe('ready')
    expect(calls).toBe(2)
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ attempt: 1, reason: 'http_503' }))
  })

  it('limits retries to five attempts and retries streaming failures', async () => {
    const stream = vi.fn(async function* (): AsyncIterable<ChatStreamChunk> {
      yield { type: 'text_delta', text: 'partial' }
      throw Object.assign(new Error('socket closed'), { code: 'ECONNRESET' })
    })
    const onRetry = vi.fn()
    const wrapped = withRuntimeNetworkRetry(provider({ stream }), { onRetry, delayMs: () => 0 })
    const chunks: ChatStreamChunk[] = []

    await expect((async () => {
      for await (const chunk of wrapped.stream(request)) {
        chunks.push(chunk)
      }
    })()).rejects.toThrow('socket closed')
    expect(stream).toHaveBeenCalledTimes(6)
    expect(onRetry).toHaveBeenCalledTimes(5)
    expect(chunks.filter(chunk => chunk.type === 'text_delta')).toHaveLength(6)
  })
})
