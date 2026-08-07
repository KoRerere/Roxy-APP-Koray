import assert from 'node:assert/strict'
import { afterEach, beforeEach, it, vi } from 'vitest'

const createLLM = vi.fn()

vi.mock('@/llm', () => ({ createLLM }))

beforeEach(() => {
  createLLM.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

it('propagates provider errors', async () => {
  const error = new Error('provider unavailable')
  createLLM.mockResolvedValue({
    invoke: vi.fn().mockRejectedValue(error),
  })

  const { buildLlmTransport } = await import('./llmTransport')

  await assert.rejects(
    buildLlmTransport('run-1').ask({ prompt: 'hello' }),
    error,
  )
})

it('aborts and rejects an LLM call that exceeds the sandbox timeout', async () => {
  vi.useFakeTimers()
  const invoke = vi.fn((_messages: unknown, config: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
    config.signal.addEventListener('abort', () => reject(config.signal.reason), { once: true })
  }))
  createLLM.mockResolvedValue({ invoke })

  const { buildLlmTransport, SANDBOX_LLM_TIMEOUT_MS } = await import('./llmTransport')
  const rejection = assert.rejects(
    buildLlmTransport('run-2').ask({ prompt: 'hello' }),
    /timed out after 60000ms/,
  )

  await vi.advanceTimersByTimeAsync(SANDBOX_LLM_TIMEOUT_MS)
  await rejection
  assert.equal(invoke.mock.calls[0][1].signal.aborted, true)
})
