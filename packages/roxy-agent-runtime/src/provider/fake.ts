import type {
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  IModelProvider,
  Message,
  StopReason,
  StructuredOutputFn,
  StructuredOutputOptions,
  ToolDescriptor,
  ToolUseBlock,
} from '../core/interfaces.ts'
import { NotImplementedError } from '../core/errors.ts'
import { assistantMessageToItems } from '../transcript/items.ts'
import type { ZodType } from 'zod'

/**
 * Deterministic provider for offline tests. NOT a production provider — it is
 * part of the test surface but lives in src so prod code can inject it.
 *
 * A test scripts the assistant turns by providing `responses` (a queue popped
 * in order) or a `handler(req)` function. `countTokens` uses a cheap ~4
 * chars/token approximation. Every call is recorded in `calls`.
 */
export interface FakeProviderOptions {
  /** Queued responses, popped in FIFO order per `.invoke()` call. */
  responses?: ChatResponse[]
  /** Alternatively, compute a response from the request. */
  handler?: (req: ChatRequest, callIndex: number) => ChatResponse
  /** Override the token counter (default ~4 chars/token). */
  tokenCounter?: (messages: Message[]) => number
}

export class FakeProvider implements IModelProvider {
  readonly id = 'fake'
  readonly contextWindowTokens: number = 262144
  private readonly queue: ChatResponse[]
  private readonly handler?: (req: ChatRequest, callIndex: number) => ChatResponse
  private readonly tokenCounter: (messages: Message[]) => number
  readonly calls: ChatRequest[] = []

  constructor(opts: FakeProviderOptions = {}) {
    this.queue = [...(opts.responses ?? [])]
    this.handler = opts.handler
    this.tokenCounter = opts.tokenCounter ?? defaultTokenCounter
  }

  invoke(req: ChatRequest, _signal?: AbortSignal): Promise<ChatResponse> {
    this.calls.push(req)
    const res = this.handler ? this.handler(req, this.calls.length - 1) : this.queue.shift()
    if (!res) {
      return Promise.reject(new Error(`FakeProvider: no scripted response for call #${this.calls.length}`))
    }
    return Promise.resolve(res)
  }

  withStructuredOutput<T, IncludeRaw extends boolean = false>(
    schema: ZodType<T>,
    options?: StructuredOutputOptions & { includeRaw?: IncludeRaw },
  ): StructuredOutputFn<IncludeRaw extends true ? { raw: Message; parsed: T } : T> {
    const method = options?.method ?? 'functionCalling'
    if (method !== 'functionCalling') {
      throw new NotImplementedError(
        `FakeProvider.withStructuredOutput: method '${method}' not supported (only 'functionCalling')`,
      )
    }
    const toolName = options?.name ?? 'extract'
    const includeRaw = options?.includeRaw ?? false
    const descriptor: ToolDescriptor = {
      name: toolName,
      description: 'Extract structured data per the provided schema.',
      inputSchema: schema,
      source: 'builtin',
    }
    const fn = async (input: string | Message[], signal?: AbortSignal): Promise<T | { raw: Message; parsed: T }> => {
      const messages: Message[] = typeof input === 'string' ? [{ role: 'user', content: input }] : [...input]
      const res = await this.invoke(
        {
          model: 'fake',
          messages,
          tools: [descriptor],
          toolChoice: { type: 'tool', name: toolName },
          maxTokens: 1024,
        },
        signal,
      )
      const block = findToolUse(res.message, toolName)
      if (!block) {
        throw new Error(`FakeProvider.withStructuredOutput: scripted response did not call tool '${toolName}'`)
      }
      const parsed = schema.parse(block.input)
      return includeRaw ? { raw: res.message, parsed } : parsed
    }
    return fn as StructuredOutputFn<IncludeRaw extends true ? { raw: Message; parsed: T } : T>
  }

  async *stream(req: ChatRequest): AsyncIterable<ChatStreamChunk> {
    const res = await this.invoke(req)
    yield* toChunks(res)
  }

  toProviderRequest(req: ChatRequest): ChatRequest {
    return req
  }

  fromProviderResponse(response: ChatResponse): ChatResponse {
    return response
  }

  countTokens(messages: Message[]): Promise<number> {
    return Promise.resolve(this.tokenCounter(messages))
  }
}

/** Find the first `tool_use` block with the given name on an assistant message. */
function findToolUse(message: Message, name: string): ToolUseBlock | undefined {
  if (typeof message.content === 'string') {
    return undefined
  }
  for (const block of message.content) {
    if (block.type === 'tool_use' && block.name === name) {
      return block
    }
  }
  return undefined
}

function defaultTokenCounter(messages: Message[]): number {
  let chars = 0
  for (const m of messages) {
    if (typeof m.content === 'string') {
      chars += m.content.length
    } else {
      for (const block of m.content) {
        if (block.type === 'text') {
          chars += block.text.length
        }
      }
    }
  }
  return Math.ceil(chars / 4)
}

function toChunks(res: ChatResponse): ChatStreamChunk[] {
  const chunks: ChatStreamChunk[] = []
  for (const item of res.items) {
    if (item.type === 'web_search_call') {
      chunks.push({ type: 'web_search_call', item })
    }
  }
  if (typeof res.message.content === 'string') {
    chunks.push({ type: 'text_delta', text: res.message.content })
  } else {
    for (const block of res.message.content) {
      if (block.type === 'text') {
        chunks.push({ type: 'text_delta', text: block.text })
      } else if (block.type === 'tool_use') {
        chunks.push({ type: 'tool_use', block })
      } else if (block.type === 'thinking') {
        // Mirror the real SSE shape: a delta (live text) then the complete
        // signed block (for history round-trip), before any text/tool_use.
        chunks.push({ type: 'thinking_delta', text: block.thinking })
        chunks.push({ type: 'thinking_block', block })
      }
    }
  }
  chunks.push({
    type: 'message_stop',
    stopReason: res.stopReason,
    usage: res.usage,
    items: res.items,
  })
  return chunks
}

/** Helper to build a scripted ChatResponse. */
export function chatResponse(
  message: Message,
  stopReason: StopReason = 'end_turn',
  usage: ChatResponse['usage'] = { inputTokens: 0, outputTokens: 0 },
): ChatResponse {
  return { items: assistantMessageToItems(message), message, stopReason, usage }
}
