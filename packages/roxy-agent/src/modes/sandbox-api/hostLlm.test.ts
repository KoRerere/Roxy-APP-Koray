import assert from 'node:assert/strict'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const getRuntimeModel = vi.fn()
const providerInvoke = vi.fn()
const providerWithStructuredOutput = vi.fn()
const providerWithJsonSchemaOutput = vi.fn()
const providerOptions: unknown[] = []

function assertReasoningDisabled(options: unknown): void {
  const value = options as { model?: unknown, reasoning?: unknown }
  assert.equal(value.model, 'custom-model')
  assert.deepEqual(value.reasoning, { effort: 'none' })
}

vi.mock('@/runtime/provider', () => ({ getRuntimeModel }))
vi.mock('roxy-agent-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('roxy-agent-runtime')>()
  return {
    ...actual,
    OpenAIResponsesProvider: class {
      constructor(options: unknown) {
        providerOptions.push(options)
      }

      invoke = providerInvoke
      withStructuredOutput = providerWithStructuredOutput
      withJsonSchemaOutput = providerWithJsonSchemaOutput
    },
  }
})

beforeEach(() => {
  getRuntimeModel.mockReset()
  providerInvoke.mockReset()
  providerWithStructuredOutput.mockReset()
  providerWithJsonSchemaOutput.mockReset()
  providerOptions.length = 0
  getRuntimeModel.mockResolvedValue({ model: 'deepseek-v4-flash', headers: {} })
})

afterEach(() => {
  vi.useRealTimers()
})

it.each([false, true])('将 Base64 图片送入模型，结构化输出=%s', async (structured) => {
  // 回归：Sandbox 仅转发 prompt，导致模型无法看到脚本传入的图片。
  // 修复：文本和结构化调用共享包含图片的 canonical 用户消息。
  providerInvoke.mockResolvedValue({ message: { content: '图片描述' } })
  const extract = vi.fn().mockResolvedValue({ description: '图片描述' })
  providerWithJsonSchemaOutput.mockReturnValue(extract)
  const { buildLlmTransport } = await import('./hostLlm')
  const images = [
    { base64: 'aW1hZ2Ux', mimeType: 'image/png' as const },
    { base64: 'aW1hZ2Uy', mimeType: 'image/jpeg' as const },
  ]
  const result = await buildLlmTransport('run-images').ask({
    prompt: '比较两张图片',
    ...(structured ? { schema: { type: 'object' } } : {}),
    options: { images },
  })
  const messages = [{ role: 'user', content: [
    { type: 'text', text: '比较两张图片' },
    ...images.map(image => ({ type: 'image', data: image.base64, mimeType: image.mimeType })),
  ] }]
  if (structured) {
    expect(extract).toHaveBeenCalledWith(messages, expect.any(AbortSignal))
    expect(result).toEqual({ description: '图片描述' })
  }
  else {
    expect(providerInvoke.mock.calls[0][0].messages).toEqual(messages)
    expect(result).toBe('图片描述')
  }
})

it('propagates provider errors', async () => {
  const error = new Error('provider unavailable')
  providerInvoke.mockRejectedValue(error)

  const { buildLlmTransport } = await import('./hostLlm')

  await assert.rejects(
    buildLlmTransport('run-1').ask({ prompt: 'hello' }),
    error,
  )
})

it('returns only visible text blocks for plain ask responses', async () => {
  providerInvoke.mockResolvedValue({
    message: {
      content: [
        { type: 'thinking', thinking: 'private reasoning', signature: 'sig_1' },
        { type: 'text', text: 'hello' },
        { type: 'tool_use', id: 'tool_1', name: 'noop', input: {} },
        { type: 'text', text: ' world' },
      ],
    },
  })

  const { buildLlmTransport } = await import('./hostLlm')
  const result = await buildLlmTransport('run-text').ask({
    prompt: 'hello',
    options: { temperature: 0.2, maxTokens: 20, model: 'custom-model' },
  })

  assert.equal(result, 'hello world')
  assert.deepEqual(providerInvoke.mock.calls[0][0], {
    model: 'custom-model',
    messages: [{ role: 'user', content: 'hello' }],
    maxTokens: 20,
    temperature: 0.2,
  })
  assertReasoningDisabled(providerOptions[0])
})

it('rejects plain ask responses that contain thinking without text', async () => {
  providerInvoke.mockResolvedValue({
    message: {
      content: [
        { type: 'thinking', thinking: 'private reasoning', signature: 'sig_1' },
      ],
    },
  })

  const { buildLlmTransport } = await import('./hostLlm')

  await assert.rejects(
    buildLlmTransport('run-thinking-only').ask({ prompt: 'hello' }),
    /no text content/,
  )
})

it('aborts and rejects an LLM call that exceeds the sandbox timeout', async () => {
  vi.useFakeTimers()
  providerInvoke.mockImplementation((_request: unknown, signal: AbortSignal) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  }))

  const { buildLlmTransport, SANDBOX_LLM_TIMEOUT_MS } = await import('./hostLlm')
  const rejection = assert.rejects(
    buildLlmTransport('run-2').ask({ prompt: 'hello' }),
    /timed out after 60000ms/,
  )

  await vi.advanceTimersByTimeAsync(SANDBOX_LLM_TIMEOUT_MS)
  await rejection
  assert.equal(providerInvoke.mock.calls[0][1].aborted, true)
})

it('returns JSON-schema output through a forced Responses function call', async () => {
  providerWithJsonSchemaOutput.mockReturnValue(vi.fn().mockResolvedValue({ price: 12 }))
  const { buildLlmTransport } = await import('./hostLlm')
  const schema = { type: 'object', properties: { price: { type: 'number' } } }
  const result = await buildLlmTransport('run-json').ask({
    prompt: 'extract price',
    schema,
    options: { temperature: 0.2, maxTokens: 77, model: 'custom-model' },
  })
  assert.deepEqual(result, { price: 12 })
  assert.deepEqual(providerWithJsonSchemaOutput.mock.calls[0][0], schema)
  assert.deepEqual(providerWithJsonSchemaOutput.mock.calls[0][1], {
    name: 'json',
    method: 'functionCalling',
    temperature: 0.2,
    maxTokens: 77,
  })
  assertReasoningDisabled(providerOptions[0])
})
