import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type OpenAI from 'openai'
import type { Response, ResponseCreateParams, ResponseStreamEvent } from 'openai/resources/responses/responses.js'
import { OpenAIResponsesProvider } from '../../src/provider/openai_responses.ts'
import type { ChatRequest, ChatStreamChunk, ToolDescriptor } from '../../src/core/interfaces.ts'
import { APPLY_PATCH_TOOL_DESCRIPTION } from '../../src/tools/builtin/apply_patch.ts'

function makeResponse(output: Response['output'], overrides: Partial<Response> = {}): Response {
  return {
    id: 'resp_1',
    object: 'response',
    created_at: 1,
    status: 'completed',
    error: null,
    incomplete_details: null,
    instructions: null,
    max_output_tokens: 1024,
    model: 'model',
    output,
    output_text: '',
    parallel_tool_calls: true,
    previous_response_id: null,
    prompt_cache_key: null,
    prompt_cache_retention: null,
    reasoning: null,
    safety_identifier: null,
    service_tier: 'default',
    store: false,
    temperature: 1,
    text: { format: { type: 'text' }, verbosity: 'medium' },
    tool_choice: 'auto',
    tools: [],
    top_logprobs: 0,
    top_p: 1,
    truncation: 'disabled',
    usage: {
      input_tokens: 12,
      input_tokens_details: { cached_tokens: 4 },
      output_tokens: 7,
      output_tokens_details: { reasoning_tokens: 3 },
      total_tokens: 19,
    },
    user: null,
    metadata: null,
    ...overrides,
  } as Response
}

function makeClient(impl: (body: ResponseCreateParams) => unknown) {
  return {
    responses: { create: vi.fn(impl) },
  } as unknown as OpenAI & { responses: { create: ReturnType<typeof vi.fn> } }
}

function request(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    model: 'deepseek-v4-flash',
    messages: [{ role: 'user', content: 'hello' }],
    maxTokens: 1024,
    ...overrides,
  }
}

const localTools: ToolDescriptor[] = [
  {
    name: 'lookup',
    description: 'Look something up',
    inputSchema: z.strictObject({ query: z.string() }),
    source: 'builtin',
  },
  {
    name: 'apply_patch',
    description: APPLY_PATCH_TOOL_DESCRIPTION,
    inputSchema: z.string(),
    source: 'builtin',
    kind: 'custom',
  },
]

describe('OpenAIResponsesProvider API', () => {
  it('counts opaque Responses history items for compaction decisions', async () => {
    const provider = new OpenAIResponsesProvider({
      apiKey: 'key',
      model: 'm',
      _client: makeClient(() => makeResponse([])),
    })
    const longSearchItem = {
      type: 'web_search_call',
      id: 'ws_long',
      status: 'completed',
      action: { type: 'search', query: 'x'.repeat(4_000) },
    } as const

    await expect(
      provider.countTokens([
        {
          role: 'assistant',
          content: '',
          transcriptItems: [{ ...longSearchItem, provider: 'openai-responses' }],
        },
      ]),
    ).resolves.toBeGreaterThan(1_000)
  })

  it('is a protocol provider configured independently from the model vendor', () => {
    // Regression: Responses support was initially modeled as a DeepSeek-specific
    // provider, coupling a wire protocol to one model vendor.
    // Fixed by: OpenAIResponsesProvider accepts any model and compatible base URL.
    const provider = new OpenAIResponsesProvider({
      apiKey: 'key',
      model: 'any-model',
      baseURL: 'https://compatible.example.test',
      _client: makeClient(() => makeResponse([])),
    })
    expect(provider.id).toBe('openai-responses')
  })

  it('maps common runtime fields and provider-specific defaults to a Responses request', async () => {
    const client = makeClient(() => makeResponse([]))
    const provider = new OpenAIResponsesProvider({
      apiKey: 'key',
      model: 'deepseek-v4-flash',
      reasoning: { effort: 'high' },
      topP: 0.8,
      topLogprobs: 5,
      user: 'user-1',
      additionalTools: [{ type: 'web_search' }],
      customToolNames: ['apply_patch'],
      _client: client,
    })

    await provider.invoke(
      request({
        system: [
          { type: 'text', text: 'base' },
          { type: 'text', text: 'rules', cache_control: { type: 'ephemeral' } },
        ],
        temperature: 0.3,
        tools: localTools,
        toolChoice: 'any',
      }),
    )

    const body = client.responses.create.mock.calls[0]?.[0] as ResponseCreateParams
    expect(body).toMatchObject({
      model: 'deepseek-v4-flash',
      instructions: 'base\n\nrules',
      temperature: 0.3,
      top_p: 0.8,
      top_logprobs: 5,
      user: 'user-1',
      reasoning: { effort: 'high' },
      tool_choice: 'auto',
      stream: false,
      store: false,
    })
    expect(body).not.toHaveProperty('max_output_tokens')
    expect(body.input).toContainEqual({ type: 'message', role: 'user', content: 'hello' })
    expect(body.tools).toContainEqual(expect.objectContaining({ type: 'function', name: 'lookup' }))
    expect(body.tools).toContainEqual({
      type: 'custom',
      name: 'apply_patch',
      description: APPLY_PATCH_TOOL_DESCRIPTION,
    })
    expect(body.tools).toContainEqual({ type: 'web_search' })
  })

  it('maps provider-hosted image files to Responses input_image content', async () => {
    const client = makeClient(() => makeResponse([]))
    const provider = new OpenAIResponsesProvider({ apiKey: 'key', model: 'm', _client: client })

    await provider.invoke(
      request({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this' },
              { type: 'file', fileId: 'file-api-1' },
            ],
            metadata: {
              attachments: [{ fileId: 'local-image-1', fileName: 'image.png' }],
            },
          },
        ],
      }),
    )

    const body = client.responses.create.mock.calls[0]?.[0] as ResponseCreateParams
    expect(body.input).toContainEqual({
      type: 'message',
      role: 'user',
      content: [
        { type: 'input_text', text: 'Describe this' },
        { type: 'input_image', file_id: 'file-api-1' },
      ],
    })
    expect(JSON.stringify(body.input)).not.toContain('local-image-1')
  })

  it('preserves developer-role context as developer input', () => {
    // Regression: host-provided Skill context was represented as a hidden user
    // message, weakening its instruction priority in Responses requests.
    // Fixed by: preserving the canonical developer role through the provider.
    const provider = new OpenAIResponsesProvider({
      apiKey: 'key',
      model: 'deepseek-v4-flash',
      _client: makeClient(() => makeResponse([])),
    })

    const body = provider.toProviderRequest(
      request({
        messages: [
          { role: 'developer', content: '<skills_instructions>catalog</skills_instructions>', visible: false },
          { role: 'user', content: 'write a script' },
        ],
      }),
    ) as ResponseCreateParams

    expect(body.input).toContainEqual({
      type: 'message',
      role: 'developer',
      content: '<skills_instructions>catalog</skills_instructions>',
    })
  })

  it('maps user image blocks to Responses input_image data URLs', () => {
    const provider = new OpenAIResponsesProvider({
      apiKey: 'key',
      model: 'deepseek-v4-flash-vision-exp',
      _client: makeClient(() => makeResponse([])),
    })

    const body = provider.toProviderRequest(
      request({
        model: 'deepseek-v4-flash-vision-exp',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is in this image?' },
              { type: 'image', mimeType: 'image/png', data: 'aGVsbG8=' },
            ],
          },
        ],
      }),
    ) as ResponseCreateParams

    expect(body.input).toContainEqual({
      type: 'message',
      role: 'user',
      content: [
        { type: 'input_text', text: 'What is in this image?' },
        { type: 'input_image', image_url: 'data:image/png;base64,aGVsbG8=' },
      ],
    })
  })

  it('exposes request and response conversion hooks', () => {
    const client = makeClient(() => makeResponse([]))
    const provider = new OpenAIResponsesProvider({
      apiKey: 'key',
      model: 'deepseek-v4-flash',
      reasoning: { effort: 'high' },
      customToolNames: ['apply_patch'],
      _client: client,
    })

    const body = provider.toProviderRequest(request({ tools: localTools, toolChoice: 'any' })) as ResponseCreateParams
    expect(client.responses.create).not.toHaveBeenCalled()
    expect(body).toMatchObject({
      model: 'deepseek-v4-flash',
      reasoning: { effort: 'high' },
      tool_choice: 'auto',
      stream: false,
      store: false,
    })
    expect(body).not.toHaveProperty('max_output_tokens')
    expect(body.tools).toContainEqual(expect.objectContaining({ type: 'function', name: 'lookup' }))
    expect(body.tools).toContainEqual({
      type: 'custom',
      name: 'apply_patch',
      description: APPLY_PATCH_TOOL_DESCRIPTION,
    })

    const response = provider.fromProviderResponse(
      makeResponse([
        {
          type: 'message',
          id: 'msg_1',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: 'converted', annotations: [], logprobs: [] }],
        },
      ]),
    )
    expect(response).toMatchObject({
      stopReason: 'end_turn',
      usage: { inputTokens: 12, outputTokens: 7, cachedInputTokens: 4, reasoningTokens: 3 },
      message: { role: 'assistant' },
    })
    expect(response.message.content).toEqual([{ type: 'text', text: 'converted' }])
  })

  it.each([undefined, 'auto' as const, 'any' as const, 'none' as const, { type: 'tool' as const, name: 'lookup' }])(
    'always lets the Responses model choose whether to use the available tools for %j',
    (toolChoice) => {
      // Regression: the provider mapped the canonical tool choice to required,
      // none, or a forced function and prevented the model from replying freely.
      // Fixed by: Responses requests expose the usable tools and always select auto.
      const provider = new OpenAIResponsesProvider({
        apiKey: 'key',
        model: 'm',
        _client: makeClient(() => makeResponse([])),
      })

      const body = provider.toProviderRequest(request({ tools: [localTools[0]!], toolChoice })) as ResponseCreateParams

      expect(body.tools).toHaveLength(1)
      expect(body.tool_choice).toBe('auto')
    },
  )

  it('rejects a function tool whose serialized parameters are not a top-level object', async () => {
    // Regression: a top-level Zod union serialized to { anyOf: [...] } and was
    // sent upstream, where DeepSeek rejected the whole first turn with HTTP 400.
    // Fixed by: validating provider-facing function schemas before any request
    // is sent and naming the incompatible tool in the local error.
    const client = makeClient(() => makeResponse([]))
    const provider = new OpenAIResponsesProvider({ apiKey: 'key', model: 'm', _client: client })
    const invalidTool: ToolDescriptor = {
      name: 'invalid_union_tool',
      description: 'Invalid for Responses function calling',
      inputSchema: z.union([z.strictObject({ value: z.string() }), z.strictObject({ count: z.number() })]),
      source: 'builtin',
    }

    await expect(provider.invoke(request({ tools: [invalidTool] }))).rejects.toThrow(
      /invalid_union_tool.*top-level JSON Schema.*type.*object/i,
    )
    expect(client.responses.create).not.toHaveBeenCalled()
  })

  it('preserves a compatible proxy error envelope that lacks a top-level error field', async () => {
    // Regression: Roxy's proxy returns { code, message, data }, while the
    // OpenAI SDK only retained response.error and reported "no body".
    // Fixed by: wrapping non-OpenAI error envelopes before the SDK constructs
    // APIError so request IDs and upstream validation details remain visible.
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: 'upstream_invalid_request',
            message: "Invalid schema for function 'lookup'",
            data: { source: 'upstream', category: 'invalid_request' },
          }),
          {
            status: 400,
            headers: { 'content-type': 'application/json', 'x-request-id': 'request-1' },
          },
        ),
    )
    const provider = new OpenAIResponsesProvider({
      apiKey: 'key',
      model: 'm',
      baseURL: 'https://compatible.example.test/v1',
      fetch: fetchMock,
    })

    await expect(provider.invoke(request())).rejects.toMatchObject({
      status: 400,
      requestID: 'request-1',
      error: {
        code: 'upstream_invalid_request',
        message: "Invalid schema for function 'lookup'",
        data: { source: 'upstream', category: 'invalid_request' },
      },
    })
  })

  it('surfaces empty proxy error bodies without crashing the SDK error path', async () => {
    // Regression: an empty 4xx body from /llm-proxy/v1 reached
    // ResponsesCompatibleOpenAI.makeStatusError() as undefined, and
    // Object.hasOwn(undefined, 'error') threw before the real HTTP error was
    // converted to an APIError.
    // Fixed by: guarding the compatibility wrapper against nullish error
    // payloads before inspecting their shape.
    const fetchMock = vi.fn(
      async () =>
        new Response('', {
          status: 400,
          headers: { 'content-type': 'application/json', 'x-request-id': 'request-empty' },
        }),
    )
    const provider = new OpenAIResponsesProvider({
      apiKey: 'key',
      model: 'm',
      baseURL: 'https://compatible.example.test/v1',
      fetch: fetchMock,
    })

    await expect(provider.invoke(request())).rejects.toMatchObject({
      status: 400,
      requestID: 'request-empty',
      message: '400 status code (no body)',
    })
  })

  it('uses Roxy transcript items to round-trip Responses-only items and custom tool kinds', async () => {
    const webSearch = { type: 'web_search_call', id: 'ws_1', status: 'completed', action: { type: 'search' } }
    const first = makeResponse([
      {
        type: 'reasoning',
        id: 'rs_1',
        content: [{ type: 'reasoning_text', text: 'think' }],
        summary: [],
      },
      { type: 'function_call', call_id: 'fc_1', name: 'lookup', arguments: '{"query":"x"}', status: 'completed' },
      { type: 'custom_tool_call', call_id: 'ct_1', name: 'apply_patch', input: '*** Begin Patch' },
      webSearch,
      {
        type: 'message',
        id: 'msg_1',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: 'done', annotations: [], logprobs: [] }],
      },
    ] as Response['output'])
    const client = makeClient(() => first)
    const provider = new OpenAIResponsesProvider({ apiKey: 'key', model: 'm', _client: client })

    const result = await provider.invoke(request())
    expect(result.stopReason).toBe('tool_use')
    expect(result.usage).toEqual({
      inputTokens: 12,
      outputTokens: 7,
      cachedInputTokens: 4,
      reasoningTokens: 3,
    })
    expect(result.message.content).toEqual([
      { type: 'thinking', thinking: 'think', signature: 'rs_1' },
      { type: 'tool_use', id: 'fc_1', name: 'lookup', input: { query: 'x' } },
      { type: 'tool_use', id: 'ct_1', name: 'apply_patch', input: '*** Begin Patch' },
      { type: 'text', text: 'done' },
    ])
    expect(result.items).toContainEqual({
      type: 'web_search_call',
      id: 'ws_1',
      status: 'completed',
      action: { type: 'search' },
      provider: 'openai-responses',
    })
    expect(result.message.transcriptItems).toEqual(result.items)

    await provider.invoke(
      request({
        messages: [
          result.message,
          {
            role: 'user',
            content: [
              { type: 'tool_result', tool_use_id: 'fc_1', content: 'found' },
              { type: 'tool_result', tool_use_id: 'ct_1', content: 'patched' },
            ],
          },
        ],
      }),
    )
    const next = client.responses.create.mock.calls[1]?.[0] as ResponseCreateParams
    expect(next.input).toContainEqual({ type: 'function_call_output', call_id: 'fc_1', output: 'found' })
    expect(next.input).toContainEqual({ type: 'custom_tool_call_output', call_id: 'ct_1', output: 'patched' })
    expect(next.input).toContainEqual(webSearch)
  })

  it('maps apply_patch as a custom free-form tool only when explicitly enabled', () => {
    const provider = new OpenAIResponsesProvider({
      apiKey: 'key',
      model: 'm',
      customToolNames: ['apply_patch'],
      _client: makeClient(() => makeResponse([])),
    })
    const body = provider.toProviderRequest(request({ tools: localTools })) as ResponseCreateParams
    expect(body.tools).toContainEqual({
      type: 'custom',
      name: 'apply_patch',
      description: APPLY_PATCH_TOOL_DESCRIPTION,
    })
    expect(body.tools).not.toContainEqual(expect.objectContaining({ type: 'custom', parameters: expect.anything() }))
    const ordinary = new OpenAIResponsesProvider({
      apiKey: 'key',
      model: 'm',
      _client: makeClient(() => makeResponse([])),
    })
    expect(() => ordinary.toProviderRequest(request({ tools: localTools }))).toThrow(
      /function tool "apply_patch" must serialize to a top-level JSON Schema with type "object"/i,
    )
  })

  it('maps semantic SSE events and carries Roxy transcript items on the terminal chunk', async () => {
    const webSearchInProgress = {
      type: 'web_search_call',
      id: 'ws_1',
      status: 'in_progress',
      action: {
        type: 'search',
        queries: ['RoxyBrowser pricing', 'ws_call_id=ws_1'],
      },
    } as Response['output'][number]
    const webSearchCompleted = {
      ...webSearchInProgress,
      status: 'completed',
    } as Response['output'][number]
    const finalResponse = makeResponse([
      { type: 'function_call', call_id: 'fc_1', name: 'lookup', arguments: '{"query":"x"}', status: 'completed' },
      webSearchCompleted,
    ] as Response['output'])
    const events = [
      {
        type: 'response.output_item.added',
        output_index: 0,
        item: { type: 'function_call', call_id: 'fc_1', name: 'lookup', arguments: '', status: 'in_progress' },
      },
      {
        type: 'response.output_item.added',
        output_index: 1,
        item: webSearchInProgress,
      },
      { type: 'response.reasoning_text.delta', item_id: 'rs_1', output_index: 1, content_index: 0, delta: 'think' },
      { type: 'response.reasoning_text.done', item_id: 'rs_1', output_index: 1, content_index: 0, text: 'think' },
      {
        type: 'response.output_text.delta',
        item_id: 'msg_1',
        output_index: 2,
        content_index: 0,
        delta: 'hello',
        logprobs: [],
      },
      { type: 'response.function_call_arguments.done', item_id: 'fc_1', output_index: 0, arguments: '{"query":"x"}' },
      {
        type: 'response.output_item.done',
        output_index: 1,
        item: webSearchCompleted,
      },
      { type: 'response.completed', response: finalResponse },
    ] as ResponseStreamEvent[]
    const client = makeClient((body) => {
      if (!body.stream) {
        return finalResponse
      }
      return (async function* () {
        for (const event of events) {
          yield event
        }
      })()
    })
    const provider = new OpenAIResponsesProvider({ apiKey: 'key', model: 'm', _client: client })

    const chunks: unknown[] = []
    for await (const chunk of provider.stream(request())) {
      chunks.push(chunk)
    }
    expect(chunks).toContainEqual({ type: 'thinking_delta', text: 'think' })
    expect(chunks).toContainEqual({
      type: 'thinking_block',
      block: { type: 'thinking', thinking: 'think', signature: 'rs_1' },
    })
    expect(chunks).toContainEqual({ type: 'text_delta', text: 'hello' })
    expect(chunks).toContainEqual({
      type: 'web_search_call',
      item: {
        type: 'web_search_call',
        id: 'ws_1',
        status: 'in_progress',
        action: {
          type: 'search',
          queries: ['RoxyBrowser pricing', 'ws_call_id=ws_1'],
        },
        provider: 'openai-responses',
      },
    })
    expect(chunks).toContainEqual({
      type: 'web_search_call',
      item: {
        type: 'web_search_call',
        id: 'ws_1',
        status: 'completed',
        action: {
          type: 'search',
          queries: ['RoxyBrowser pricing', 'ws_call_id=ws_1'],
        },
        provider: 'openai-responses',
      },
    })
    expect(chunks).toContainEqual({
      type: 'tool_use',
      block: { type: 'tool_use', id: 'fc_1', name: 'lookup', input: { query: 'x' } },
    })
    expect(chunks.at(-1)).toMatchObject({
      type: 'message_stop',
      stopReason: 'tool_use',
      items: [
        {
          type: 'tool_call',
          callId: 'fc_1',
          name: 'lookup',
          toolKind: 'function',
          provider: 'openai-responses',
        },
        {
          type: 'web_search_call',
          id: 'ws_1',
          status: 'completed',
          action: {
            type: 'search',
            queries: ['RoxyBrowser pricing', 'ws_call_id=ws_1'],
          },
          provider: 'openai-responses',
        },
      ],
    })
  })

  it('preserves a later web search action after an empty streaming item', async () => {
    const webSearchStarted = {
      type: 'web_search_call',
      id: 'ws-delayed',
      status: 'in_progress',
    } as Response['output'][number]
    const webSearchCompleted = {
      type: 'web_search_call',
      id: 'ws-delayed',
      status: 'completed',
      action: {
        type: 'open_page',
        url: 'https://example.com/docs#ws_call_id=ws-delayed',
      },
    } as Response['output'][number]
    const finalResponse = makeResponse([webSearchCompleted] as Response['output'])
    const client = makeClient(() =>
      (async function* () {
        yield {
          type: 'response.output_item.added',
          output_index: 0,
          item: webSearchStarted,
        } as ResponseStreamEvent
        yield {
          type: 'response.output_item.done',
          output_index: 0,
          item: webSearchCompleted,
        } as ResponseStreamEvent
        yield { type: 'response.completed', response: finalResponse } as ResponseStreamEvent
      })(),
    )
    const provider = new OpenAIResponsesProvider({ apiKey: 'key', model: 'm', _client: client })

    const chunks: ChatStreamChunk[] = []
    for await (const chunk of provider.stream(request())) {
      chunks.push(chunk)
    }

    expect(chunks).toContainEqual({
      type: 'web_search_call',
      item: {
        type: 'web_search_call',
        id: 'ws-delayed',
        status: 'in_progress',
        provider: 'openai-responses',
      },
    })
    expect(chunks).toContainEqual({
      type: 'web_search_call',
      item: {
        type: 'web_search_call',
        id: 'ws-delayed',
        status: 'completed',
        action: {
          type: 'open_page',
          url: 'https://example.com/docs#ws_call_id=ws-delayed',
        },
        provider: 'openai-responses',
      },
    })
  })

  it('streams custom tool calls and surfaces incomplete and failed terminal events', async () => {
    // Regression: handling only function_call SSE events made DeepSeek's
    // Codex-compatible apply_patch custom tool disappear from streamed turns.
    // Fixed by: mapping custom_tool_call_input.done and treating incomplete as an error.
    const customItem = {
      type: 'custom_tool_call',
      id: 'ct_item_1',
      call_id: 'ct_1',
      name: 'apply_patch',
      input: '*** Begin Patch',
    } as Response['output'][number]
    const incompleteResponse = makeResponse([customItem], {
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
    })
    const client = makeClient(() =>
      (async function* () {
        yield {
          type: 'response.output_item.added',
          output_index: 0,
          item: customItem,
        } as ResponseStreamEvent
        yield {
          type: 'response.custom_tool_call_input.done',
          item_id: 'ct_item_1',
          output_index: 0,
          input: '*** Begin Patch',
        } as ResponseStreamEvent
        yield { type: 'response.incomplete', response: incompleteResponse } as ResponseStreamEvent
      })(),
    )
    const provider = new OpenAIResponsesProvider({ apiKey: 'key', model: 'm', _client: client })

    const chunks: ChatStreamChunk[] = []
    await expect(async () => {
      for await (const chunk of provider.stream(request())) {
        chunks.push(chunk)
      }
    }).rejects.toThrow(/incomplete response returned, reason: max_output_tokens/i)
    expect(chunks).toContainEqual({
      type: 'tool_use',
      block: { type: 'tool_use', id: 'ct_1', name: 'apply_patch', input: '*** Begin Patch' },
    })

    const failedResponse = makeResponse([], {
      status: 'failed',
      error: { code: 'server_error', message: 'stream boom' },
    })
    const failedClient = makeClient(() =>
      (async function* () {
        yield { type: 'response.failed', response: failedResponse } as ResponseStreamEvent
      })(),
    )
    const failedProvider = new OpenAIResponsesProvider({ apiKey: 'key', model: 'm', _client: failedClient })
    await expect(async () => {
      for await (const chunk of failedProvider.stream(request())) {
        void chunk
      }
    }).rejects.toThrow(/server_error.*stream boom/i)
  })

  it('preserves end_turn=false as a follow-up signal', async () => {
    const response = makeResponse(
      [
        {
          type: 'message',
          id: 'msg_1',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: 'continue', annotations: [], logprobs: [] }],
        },
      ],
      { ...({ end_turn: false } as unknown as Partial<Response>) },
    )
    const client = makeClient(() => response)
    const provider = new OpenAIResponsesProvider({ apiKey: 'key', model: 'm', _client: client })

    await expect(provider.invoke(request())).resolves.toMatchObject({ endTurn: false, stopReason: 'end_turn' })

    const streamedClient = makeClient((body) => {
      if (!body.stream) {
        return response
      }
      return (async function* () {
        yield { type: 'response.completed', response } as ResponseStreamEvent
      })()
    })
    const streamedProvider = new OpenAIResponsesProvider({ apiKey: 'key', model: 'm', _client: streamedClient })
    const chunks: Array<ChatStreamChunk> = []
    for await (const chunk of streamedProvider.stream(request())) {
      chunks.push(chunk)
    }
    expect(chunks.at(-1)).toMatchObject({ type: 'message_stop', endTurn: false, stopReason: 'end_turn' })
  })

  it('uses Responses JSON Schema structured output', async () => {
    const client = makeClient(() =>
      makeResponse([
        {
          type: 'message',
          id: 'msg_1',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: '{"ok":true}', annotations: [], logprobs: [] }],
        },
      ]),
    )
    const provider = new OpenAIResponsesProvider({ apiKey: 'key', model: 'm', _client: client })

    expect(await provider.withStructuredOutput(z.object({ ok: z.boolean() }))('return json')).toEqual({ ok: true })
    const body = client.responses.create.mock.calls[0]?.[0] as ResponseCreateParams
    expect(body.text?.format).toMatchObject({ type: 'json_schema', name: 'extract', strict: true })
  })

  it('preserves raw JSON Schema objects for Responses structured output', async () => {
    // Regression: sandbox json() converted raw JSON Schema to Zod and back,
    // which emitted additionalProperties as an object and DeepSeek rejected it
    // with "invalid type: map, expected a boolean".
    // Fixed by: sending the caller-provided JSON Schema without a lossy round-trip.
    const client = makeClient(() =>
      makeResponse([
        {
          type: 'message',
          id: 'msg_1',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: '{"position":"pre"}', annotations: [], logprobs: [] }],
        },
      ]),
    )
    const provider = new OpenAIResponsesProvider({ apiKey: 'key', model: 'm', _client: client })
    const schema = {
      type: 'object',
      properties: {
        behaviorEvents: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              position: {},
            },
          },
        },
      },
    }

    await expect(provider.withJsonSchemaOutput(schema, { name: 'json' })('return json')).resolves.toEqual({
      position: 'pre',
    })
    const body = client.responses.create.mock.calls[0]?.[0] as ResponseCreateParams
    expect(body.text?.format).toEqual({
      type: 'json_schema',
      name: 'json',
      schema,
      strict: true,
    })
  })

  it('uses JSON mode and validates raw JSON Schema output', async () => {
    // Regression: Sandbox json() sent native json_schema output to a model path
    // that returned plain text, and accepted structured output without validation.
    // Fixed by: using Responses JSON mode and validating the parsed value locally.
    const client = makeClient(() =>
      makeResponse([
        {
          type: 'message',
          id: 'msg_1',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: '{"price":12}', annotations: [], logprobs: [] }],
        },
      ]),
    )
    const provider = new OpenAIResponsesProvider({
      apiKey: 'key',
      model: 'm',
      reasoning: { effort: 'none' },
      _client: client,
    })
    const schema = { type: 'object', properties: { price: { type: 'number' } }, required: ['price'] }

    await expect(
      provider.withJsonSchemaOutput(schema, {
        name: 'json',
        method: 'jsonMode',
        temperature: 0.2,
        maxTokens: 77,
      })('return json'),
    ).resolves.toEqual({ price: 12 })

    const body = client.responses.create.mock.calls[0]?.[0] as ResponseCreateParams
    expect(body).toMatchObject({
      instructions: expect.stringContaining(JSON.stringify(schema)),
      max_output_tokens: 77,
      reasoning: { effort: 'none' },
      temperature: 0.2,
    })
    expect(body.text?.format).toEqual({ type: 'json_object' })
  })

  it('reports an incomplete Responses result before parsing partial JSON', async () => {
    // Regression: a Responses response truncated at max_output_tokens was
    // reported as invalid JSON, hiding the actual provider termination reason.
    // Fixed by: handling the Responses incomplete status before extraction.
    const client = makeClient(() =>
      makeResponse(
        [
          {
            type: 'message',
            id: 'msg_1',
            role: 'assistant',
            status: 'incomplete',
            content: [{ type: 'output_text', text: '{"items":[{"name":"partial"', annotations: [], logprobs: [] }],
          },
        ],
        { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } },
      ),
    )
    const provider = new OpenAIResponsesProvider({ apiKey: 'key', model: 'm', _client: client })

    await expect(
      provider.withJsonSchemaOutput({ type: 'object', properties: {} }, { method: 'jsonMode' })('return json'),
    ).rejects.toThrow(
      /incomplete response returned, reason: max_output_tokens.*status=incomplete.*outputTokens=7.*reasoningTokens=3.*textLength=27/,
    )
  })

  it('reports Responses metadata when completed output is invalid JSON', async () => {
    const client = makeClient(() =>
      makeResponse([
        {
          type: 'message',
          id: 'msg_1',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: '{"items":[', annotations: [], logprobs: [] }],
        },
      ]),
    )
    const provider = new OpenAIResponsesProvider({ apiKey: 'key', model: 'm', _client: client })

    await expect(
      provider.withJsonSchemaOutput({ type: 'object', properties: {} }, { method: 'jsonMode' })('return json'),
    ).rejects.toThrow(/invalid JSON.*status=completed.*outputTokens=7.*reasoningTokens=3.*textLength=10/)
  })

  it('coerces JSON mode output when a string safely converts to the raw JSON Schema type', async () => {
    // Regression: models sometimes serialize numeric fields as strings even
    // when the caller's JSON Schema requires a number.
    // Fixed by: applying lossless schema-directed coercion before validation.
    const client = makeClient(() =>
      makeResponse([
        {
          type: 'message',
          id: 'msg_1',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: '{"price":"12"}', annotations: [], logprobs: [] }],
        },
      ]),
    )
    const provider = new OpenAIResponsesProvider({ apiKey: 'key', model: 'm', _client: client })
    const schema = { type: 'object', properties: { price: { type: 'number' } }, required: ['price'] }

    await expect(provider.withJsonSchemaOutput(schema, { method: 'jsonMode' })('return json')).resolves.toEqual({
      price: 12,
    })
  })

  it('supports function calling and JSON mode structured output', async () => {
    // Regression: the provider exposed the shared StructuredOutputOptions but
    // initially covered only one Responses extraction strategy.
    // Fixed by: mapping all interface methods to their native Responses forms.
    const functionClient = makeClient(() =>
      makeResponse([
        {
          type: 'function_call',
          call_id: 'fc_1',
          name: 'result',
          arguments: '{"ok":true}',
          status: 'completed',
        },
      ] as Response['output']),
    )
    const functionProvider = new OpenAIResponsesProvider({ apiKey: 'key', model: 'm', _client: functionClient })
    expect(
      await functionProvider.withStructuredOutput(z.object({ ok: z.boolean() }), {
        method: 'functionCalling',
        name: 'result',
      })('return json'),
    ).toEqual({ ok: true })
    const functionBody = functionClient.responses.create.mock.calls[0]?.[0] as ResponseCreateParams
    expect(functionBody.tool_choice).toEqual({ type: 'function', name: 'result' })

    const jsonClient = makeClient(() =>
      makeResponse([
        {
          type: 'message',
          id: 'msg_1',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: '{"ok":true}', annotations: [], logprobs: [] }],
        },
      ]),
    )
    const jsonProvider = new OpenAIResponsesProvider({ apiKey: 'key', model: 'm', _client: jsonClient })
    expect(
      await jsonProvider.withStructuredOutput(z.object({ ok: z.boolean() }), { method: 'jsonMode' })('return json'),
    ).toEqual({ ok: true })
    const jsonBody = jsonClient.responses.create.mock.calls[0]?.[0] as ResponseCreateParams
    expect(jsonBody.text?.format).toEqual({ type: 'json_object' })
  })

  it('uses a raw JSON Schema for forced function-call output', async () => {
    // Regression: Sandbox json() used JSON text mode, so DeepSeek could return
    // numeric fields as strings and fail only during local schema validation.
    // Fixed by: forcing a function call while preserving the caller's raw JSON Schema.
    const client = makeClient(() =>
      makeResponse([
        {
          type: 'function_call',
          call_id: 'fc_json',
          name: 'json',
          arguments: '{"feedbackMessageIndex":"2"}',
          status: 'completed',
        },
      ] as Response['output']),
    )
    const provider = new OpenAIResponsesProvider({ apiKey: 'key', model: 'm', _client: client })
    const schema = {
      type: 'object',
      properties: { feedbackMessageIndex: { type: 'number' } },
      required: ['feedbackMessageIndex'],
      additionalProperties: false,
    }

    await expect(
      provider.withJsonSchemaOutput(schema, {
        name: 'json',
        method: 'functionCalling',
        temperature: 0.2,
        maxTokens: 77,
      })('return json'),
    ).resolves.toEqual({ feedbackMessageIndex: 2 })

    const body = client.responses.create.mock.calls[0]?.[0] as ResponseCreateParams
    expect(body.tools).toEqual([
      {
        type: 'function',
        name: 'json',
        description: 'Return the requested structured data.',
        parameters: schema,
        strict: true,
      },
    ])
    expect(body.tool_choice).toEqual({ type: 'function', name: 'json' })
    expect(body.max_output_tokens).toBe(77)
    expect(body.temperature).toBe(0.2)
  })

  it('rejects function-call values that cannot be coerced to the raw JSON Schema', async () => {
    // Regression: type coercion must not turn malformed numeric strings into
    // partial numbers or hide an output that still violates the caller's schema.
    // Fixed by: accepting only lossless schema-directed primitive coercions.
    const client = makeClient(() =>
      makeResponse([
        {
          type: 'function_call',
          call_id: 'fc_invalid_json',
          name: 'json',
          arguments: '{"feedbackMessageIndex":"2abc"}',
          status: 'completed',
        },
      ] as Response['output']),
    )
    const provider = new OpenAIResponsesProvider({ apiKey: 'key', model: 'm', _client: client })
    const schema = {
      type: 'object',
      properties: { feedbackMessageIndex: { type: 'number' } },
      required: ['feedbackMessageIndex'],
      additionalProperties: false,
    }

    await expect(
      provider.withJsonSchemaOutput(schema, { name: 'json', method: 'functionCalling' })('return json'),
    ).rejects.toThrow(/does not match JSON Schema/)
  })

  it('coerces nested array values through anyOf schema branches', async () => {
    // Regression: schema coercion at the root did not cover primitive values
    // nested inside arrays, objects, and anyOf branches used by behavior events.
    // Fixed by: recursively applying coercion through structural schema nodes.
    const client = makeClient(() =>
      makeResponse([
        {
          type: 'function_call',
          call_id: 'fc_nested_json',
          name: 'json',
          arguments: '{"behaviorEvents":[{"position":"3","enabled":"false"}]}',
          status: 'completed',
        },
      ] as Response['output']),
    )
    const provider = new OpenAIResponsesProvider({ apiKey: 'key', model: 'm', _client: client })
    const schema = {
      type: 'object',
      properties: {
        behaviorEvents: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              position: {
                anyOf: [{ type: 'string', enum: ['pre', 'post'] }, { type: 'number' }],
              },
              enabled: { type: 'boolean' },
            },
            required: ['position', 'enabled'],
          },
        },
      },
      required: ['behaviorEvents'],
    }

    await expect(
      provider.withJsonSchemaOutput(schema, { name: 'json', method: 'functionCalling' })('return json'),
    ).resolves.toEqual({ behaviorEvents: [{ position: 3, enabled: false }] })
  })

  it('maps incomplete responses and surfaces failed responses', async () => {
    const incompleteClient = makeClient(() =>
      makeResponse([], { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }),
    )
    const incomplete = new OpenAIResponsesProvider({ apiKey: 'key', model: 'm', _client: incompleteClient })
    await expect(incomplete.invoke(request())).rejects.toThrow(
      /incomplete response returned, reason: max_output_tokens/i,
    )

    const failedClient = makeClient(() =>
      makeResponse([], { status: 'failed', error: { code: 'server_error', message: 'boom' } }),
    )
    const failed = new OpenAIResponsesProvider({ apiKey: 'key', model: 'm', _client: failedClient })
    await expect(failed.invoke(request())).rejects.toThrow(/server_error.*boom/i)
  })
})
