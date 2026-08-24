import Anthropic from '@anthropic-ai/sdk'
import { NotImplementedError } from '../core/errors.ts'
import type {
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  ContentBlock,
  IModelProvider,
  Message,
  StopReason,
  StructuredOutputFn,
  StructuredOutputOptions,
  SystemBlock,
  ThinkingBlock,
  ToolDescriptor,
  ToolUseBlock,
} from '../core/interfaces.ts'
import { zodToJsonSchema } from '../tools/schema.ts'
import { assistantMessageToItems } from '../transcript/items.ts'
import { estimateTokens } from './estimate.ts'
import type { ZodType } from 'zod'

export interface AnthropicProviderOptions {
  /** API key already resolved by the host application. */
  apiKey: string
  model: string
  /**
   * Override the API base URL — use to target an Anthropic-protocol-compatible
   * provider (e.g. DeepSeek). Omit to use the Anthropic SDK default.
   */
  baseURL?: string
  /**
   * Extra HTTP headers sent on every request (merged into the SDK client's
   * `defaultHeaders`). Use for tracing/routing headers such as
   * `Conversation-Id`, `Turn-Id`, or `ai-agent-version` when talking to an
   * Anthropic-protocol proxy, and for custom authentication schemes such as
   * `Authorization: Bearer <key>`.
   */
  defaultHeaders?: Record<string, string>
  /**
   * Enable extended thinking. When set, every request carries
   * `thinking: { type: "enabled", budget_tokens }` and `temperature` is
   * omitted (Anthropic rejects the combination). Thinking blocks returned by
   * the API (with their `signature`) flow through `invoke()`/`stream()` so
   * the agent loop can round-trip them on subsequent turns.
   */
  thinking?: { budgetTokens: number }
  /**
   * Anthropic prompt caching (default true). When on, requests without any
   * explicit `cache_control` get two automatic breakpoints: the last system
   * block (caches the tools + system prefix) and the last message's last
   * cacheable block (a moving breakpoint — Anthropic looks back up to ~20
   * blocks for hits, so the previous turn's prefix is reused). Explicit
   * breakpoints anywhere in the request disable auto-placement (the caller
   * owns it). When off, every `cache_control` is STRIPPED before sending —
   * required by Anthropic-compatible endpoints that reject the field (e.g.
   * DeepSeek, which caches server-side on its own).
   */
  promptCaching?: boolean
  /**
   * Use the real count-tokens endpoint for {@link countTokens} (default
   * true), falling back to the chars/4 heuristic on any error. Set false for
   * Anthropic-compatible endpoints that do not implement it (e.g. DeepSeek).
   */
  countTokensApi?: boolean
  /** Test back-door: inject a pre-built Anthropic client instead of creating one. */
  _client?: Anthropic
  /** Override model context window tokens (default 262144 = 256 KiB). */
  contextWindowTokens?: number
}

// ---------------------------------------------------------------------------
// Request mapping helpers
// ---------------------------------------------------------------------------

/**
 * Minimal structural view of an Anthropic SSE `RawMessageStreamEvent`. We cast
 * conservatively (the SDK's full union is verbose and version-volatile); the
 * fields read below are stable across the events we handle.
 */
type RawDelta = { type: string } & Record<string, unknown>

type RawEvent =
  | { type: 'message_start'; message: { usage?: { input_tokens?: number } } }
  | {
      type: 'content_block_start'
      index: number
      content_block: { type: string; id?: string; name?: string }
    }
  | { type: 'content_block_delta'; index: number; delta: RawDelta }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; delta: { stop_reason?: string | null }; usage?: { output_tokens?: number } }
  | { type: 'message_stop' }

type MessageCreateParamsWithOptionalMaxTokens = Omit<Anthropic.MessageCreateParamsNonStreaming, 'max_tokens'> & {
  max_tokens?: Anthropic.MessageCreateParamsNonStreaming['max_tokens']
}

function mapMessages(messages: Message[]): Anthropic.MessageParam[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      if (typeof m.content === 'string') {
        return {
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }
      }
      // Block array — cast since our ContentBlock shapes are compatible
      return {
        role: m.role as 'user' | 'assistant',
        content: m.content as unknown as Anthropic.ContentBlockParam[],
      }
    })
}

function mapDeveloperMessages(messages: Message[]): SystemBlock[] {
  return messages
    .filter((m) => m.role === 'developer')
    .map((m) => ({
      type: 'text' as const,
      text: typeof m.content === 'string'
        ? m.content
        : m.content
          .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
          .map((block) => block.text)
          .join('\n'),
    }))
}

function mapSystem(system: SystemBlock[]): Anthropic.TextBlockParam[] {
  return system.map((b) => {
    const block: Anthropic.TextBlockParam = { type: 'text', text: b.text }
    if (b.cache_control) {
      block.cache_control = b.cache_control
    }
    return block
  })
}

// ---------------------------------------------------------------------------
// Prompt caching
// ---------------------------------------------------------------------------

const EPHEMERAL = { type: 'ephemeral' as const }

/** Block types that may legally carry `cache_control` (thinking may not). */
const CACHEABLE_BLOCK_TYPES = new Set(['text', 'tool_use', 'tool_result', 'image', 'document'])

type MutableBlock = { type: string; text?: string; cache_control?: { type: 'ephemeral' } }

function hasExplicitBreakpoints(body: MessageCreateParamsWithOptionalMaxTokens): boolean {
  const system = body.system as Anthropic.TextBlockParam[] | undefined
  if (system?.some((b) => b.cache_control)) {
    return true
  }
  return body.messages.some(
    (m) => Array.isArray(m.content) && (m.content as MutableBlock[]).some((b) => b.cache_control),
  )
}

/** A block can take the breakpoint marker (empty text blocks are rejected by the API). */
function isCacheable(b: MutableBlock): boolean {
  if (!CACHEABLE_BLOCK_TYPES.has(b.type)) {
    return false
  }
  return b.type !== 'text' || (b.text ?? '').length > 0
}

/**
 * Add the two automatic breakpoints (last system block + last message's last
 * cacheable block). Never mutates blocks it did not create — message content
 * arrays are shared BY REFERENCE with the caller's history, so marked blocks
 * are re-built copies.
 */
function addAutoBreakpoints(body: MessageCreateParamsWithOptionalMaxTokens): MessageCreateParamsWithOptionalMaxTokens {
  const system = body.system as Anthropic.TextBlockParam[] | undefined
  if (system && system.length > 0) {
    const last = system[system.length - 1]!
    // mapSystem built these objects fresh — safe to mutate in place.
    if (last.text.length > 0) {
      last.cache_control = EPHEMERAL
    }
  }

  const lastMsg = body.messages[body.messages.length - 1]
  if (!lastMsg) {
    return body
  }

  if (typeof lastMsg.content === 'string') {
    if (lastMsg.content.length === 0) {
      return body
    }
    const content = [{ type: 'text' as const, text: lastMsg.content, cache_control: EPHEMERAL }]
    body.messages = [...body.messages.slice(0, -1), { ...lastMsg, content }]
    return body
  }

  const blocks = lastMsg.content as MutableBlock[]
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (isCacheable(blocks[i]!)) {
      const marked = blocks.map((b, j) => (j === i ? Object.assign({}, b, { cache_control: EPHEMERAL }) : b))
      body.messages = [...body.messages.slice(0, -1), { ...lastMsg, content: marked as Anthropic.ContentBlockParam[] }]
      return body
    }
  }
  return body
}

/**
 * Remove every `cache_control` so nothing cache-related reaches endpoints that
 * reject the field. Message blocks are shared with the caller — strip on copies.
 */
function stripCacheControl(body: MessageCreateParamsWithOptionalMaxTokens): MessageCreateParamsWithOptionalMaxTokens {
  const system = body.system as Anthropic.TextBlockParam[] | undefined
  if (system) {
    for (const b of system) {
      delete b.cache_control
    } // fresh objects from mapSystem
  }
  body.messages = body.messages.map((m) => {
    if (!Array.isArray(m.content)) {
      return m
    }
    const blocks = m.content as MutableBlock[]
    if (!blocks.some((b) => b.cache_control)) {
      return m
    }
    const stripped = blocks.map((b) => {
      if (!b.cache_control) {
        return b
      }
      const { cache_control: _dropped, ...rest } = b
      return rest
    })
    return { ...m, content: stripped as Anthropic.ContentBlockParam[] }
  })
  return body
}

function mapTools(tools: ToolDescriptor[]): Anthropic.Tool[] {
  return tools
    .filter((tool) => tool.kind !== 'custom')
    .map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: zodToJsonSchema(t.inputSchema) as Anthropic.Tool['input_schema'],
    }))
}

function mapToolChoice(tc: ChatRequest['toolChoice']): Anthropic.ToolChoice | undefined {
  if (!tc) {
    return undefined
  }
  if (tc === 'auto') {
    return { type: 'auto' }
  }
  if (tc === 'any') {
    return { type: 'any' }
  }
  if (tc === 'none') {
    return { type: 'none' }
  }
  return { type: 'tool', name: tc.name }
}

// ---------------------------------------------------------------------------
// Response mapping helpers
// ---------------------------------------------------------------------------

function mapStopReason(r: string | null): StopReason {
  if (r === 'end_turn' || r === 'tool_use' || r === 'max_tokens' || r === 'stop_sequence' || r === 'pause_turn') {
    return r
  }
  return 'end_turn'
}

function mapResponseContent(content: Anthropic.ContentBlock[]): ContentBlock[] {
  return content.map((b) => {
    if (b.type === 'text') {
      return { type: 'text' as const, text: b.text }
    }
    if (b.type === 'tool_use') {
      return {
        type: 'tool_use' as const,
        id: b.id,
        name: b.name,
        input: b.input,
      }
    }
    if (b.type === 'thinking') {
      // Signature MUST be preserved verbatim for multi-turn round-trip.
      return {
        type: 'thinking' as const,
        thinking: b.thinking,
        signature: (b as { signature?: string }).signature ?? '',
      } satisfies ThinkingBlock
    }
    // Fall through: return as-is (cast) for any other block types
    return b as unknown as ContentBlock
  })
}

function findToolUse(message: Message, toolName: string): ToolUseBlock | undefined {
  if (!Array.isArray(message.content)) {
    return undefined
  }
  return (message.content as ContentBlock[]).find(
    (b): b is ToolUseBlock => b.type === 'tool_use' && b.name === toolName,
  )
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Wraps `@anthropic-ai/sdk` messages API, mapping roxy's provider-neutral
 * {@link ChatRequest} to Anthropic's shape and parsing `tool_use` blocks back.
 */
/**
 * Options passed to the Anthropic SDK constructor.
 */
export interface AnthropicClientOptions {
  apiKey: string
  baseURL?: string
  defaultHeaders?: Record<string, string>
}

/**
 * Pure mapping from {@link AnthropicProviderOptions} to the Anthropic SDK
 * constructor options. Extracted as a seam so the header/baseURL wiring is
 * unit-testable without constructing a real SDK client.
 *
 * Contract:
 * - `apiKey`: the host-resolved credential, forwarded unchanged.
 * - `baseURL`: forwarded VERBATIM — never rewritten (no `/anthropic` suffix;
 *   that derivation belongs to {@link DeepseekProvider}, not here).
 * - `defaultHeaders`: forwarded from the caller unchanged.
 */
export function buildClientOptions(opts: AnthropicProviderOptions): AnthropicClientOptions {
  return {
    apiKey: opts.apiKey,
    ...(opts.baseURL ? { baseURL: opts.baseURL } : {}),
    ...(opts.defaultHeaders ? { defaultHeaders: opts.defaultHeaders } : {}),
  }
}

export class AnthropicProvider implements IModelProvider {
  readonly id = 'anthropic'
  readonly contextWindowTokens: number
  private readonly client: Anthropic
  private readonly defaultModel: string
  private readonly thinking?: { budgetTokens: number }
  private readonly promptCaching: boolean
  private readonly countTokensApi: boolean

  constructor(opts: AnthropicProviderOptions) {
    this.defaultModel = opts.model
    this.contextWindowTokens = opts.contextWindowTokens ?? 262144 // 256 KiB default
    this.thinking = opts.thinking
    this.promptCaching = opts.promptCaching ?? true
    this.countTokensApi = opts.countTokensApi ?? true
    if (opts._client) {
      this.client = opts._client
    } else {
      this.client = new Anthropic(buildClientOptions(opts))
    }
  }

  /**
   * Build the request body shared by `invoke()` and `stream()`. When
   * `thinking` is enabled, attaches `thinking` and DROPS `temperature`
   * (Anthropic rejects the combination with a 400).
   */
  toProviderRequest(req: ChatRequest): MessageCreateParamsWithOptionalMaxTokens {
    const thinkingEnabled = this.thinking !== undefined
    const systemBlocks = [
      ...(req.system ?? []),
      ...mapDeveloperMessages(req.messages),
    ]
    const body: MessageCreateParamsWithOptionalMaxTokens = {
      model: req.model ?? this.defaultModel,
      messages: mapMessages(req.messages),
      ...(req.maxTokens !== undefined ? { max_tokens: req.maxTokens } : {}),
      ...(systemBlocks.length > 0 ? { system: mapSystem(systemBlocks) } : {}),
      ...(req.tools ? { tools: mapTools(req.tools) } : {}),
      ...(req.toolChoice ? { tool_choice: mapToolChoice(req.toolChoice) } : {}),
      // temperature is incompatible with thinking — omit it when enabled.
      ...(!thinkingEnabled && req.temperature !== undefined ? { temperature: req.temperature } : {}),
      ...(thinkingEnabled
        ? {
            thinking: {
              type: 'enabled' as const,
              budget_tokens: this.thinking!.budgetTokens,
            },
          }
        : {}),
    }
    if (!this.promptCaching) {
      return stripCacheControl(body)
    }
    // Explicit breakpoints anywhere → the caller owns placement.
    return hasExplicitBreakpoints(body) ? body : addAutoBreakpoints(body)
  }

  fromProviderResponse(response: unknown): ChatResponse {
    const message = response as Anthropic.Message
    const assistantMessage: Message = {
      role: 'assistant',
      content: mapResponseContent(message.content as Anthropic.ContentBlock[]),
    }
    return {
      items: assistantMessageToItems(assistantMessage),
      message: assistantMessage,
      stopReason: mapStopReason(message.stop_reason),
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    }
  }

  async invoke(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    const body = this.toProviderRequest(req)

    const response = await this.client.messages.create(
      body as Anthropic.MessageCreateParamsNonStreaming,
      {
        signal,
      } as Anthropic.RequestOptions,
    )

    return this.fromProviderResponse(response)
  }

  /**
   * Real SSE streaming via `messages.stream()`. Iterates `RawMessageStreamEvent`s
   * and emits `text_delta` / `thinking_delta` / `thinking_block` / `tool_use`
   * chunks, then a final `message_stop`. Thinking deltas are streamed token-by-
   * token for live CLI rendering; the complete `thinking_block` (carrying the
   * `signature`) is emitted at `content_block_stop` so the agent loop can store
   * it in history for multi-turn round-trip.
   */
  async *stream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatStreamChunk> {
    const body = this.toProviderRequest(req)
    const stream = this.client.messages.stream(
      body as Anthropic.MessageCreateParamsNonStreaming,
      {
        signal,
      } as Anthropic.RequestOptions,
    )

    // Per-index block accumulation.
    type BlockBuf =
      | { kind: 'text' }
      | { kind: 'thinking'; text: string; signature: string }
      | { kind: 'tool_use'; id: string; name: string; inputJson: string }
    const blocks = new Map<number, BlockBuf>()

    let stopReason: StopReason = 'end_turn'
    let inputTokens = 0
    let outputTokens = 0

    for await (const event of stream as AsyncIterable<RawEvent>) {
      switch (event.type) {
        case 'message_start': {
          const u = event.message.usage
          if (u?.input_tokens != null) {
            inputTokens = u.input_tokens
          }
          break
        }
        case 'content_block_start': {
          const cb = event.content_block
          if (cb.type === 'thinking') {
            blocks.set(event.index, { kind: 'thinking', text: '', signature: '' })
          } else if (cb.type === 'tool_use') {
            blocks.set(event.index, {
              kind: 'tool_use',
              id: cb.id ?? '',
              name: cb.name ?? '',
              inputJson: '',
            })
          } else {
            blocks.set(event.index, { kind: 'text' })
          }
          break
        }
        case 'content_block_delta': {
          const buf = blocks.get(event.index)
          if (!buf) {
            break
          }
          const d = event.delta
          const str = (k: string): string => (typeof d[k] === 'string' ? (d[k] as string) : '')
          if (d.type === 'text_delta' && buf.kind === 'text') {
            yield { type: 'text_delta', text: str('text') }
          } else if (d.type === 'thinking_delta' && buf.kind === 'thinking') {
            const text = str('thinking')
            buf.text += text
            yield { type: 'thinking_delta', text }
          } else if (d.type === 'signature_delta' && buf.kind === 'thinking') {
            buf.signature += str('signature')
          } else if (d.type === 'input_json_delta' && buf.kind === 'tool_use') {
            buf.inputJson += str('partial_json')
          }
          break
        }
        case 'content_block_stop': {
          const buf = blocks.get(event.index)
          if (!buf) {
            break
          }
          if (buf.kind === 'thinking') {
            yield {
              type: 'thinking_block',
              block: {
                type: 'thinking',
                thinking: buf.text,
                signature: buf.signature,
              },
            }
          } else if (buf.kind === 'tool_use') {
            let input: unknown = {}
            try {
              input = buf.inputJson ? JSON.parse(buf.inputJson) : {}
            } catch {
              input = {}
            }
            yield {
              type: 'tool_use',
              block: { type: 'tool_use', id: buf.id, name: buf.name, input },
            }
          }
          blocks.delete(event.index)
          break
        }
        case 'message_delta': {
          const delta = event.delta as { stop_reason?: string | null }
          if (delta.stop_reason) {
            stopReason = mapStopReason(delta.stop_reason)
          }
          const u = event.usage as { output_tokens?: number } | undefined
          if (u?.output_tokens != null) {
            outputTokens = u.output_tokens
          }
          break
        }
        case 'message_stop':
          break
      }
    }

    yield {
      type: 'message_stop',
      stopReason,
      usage: { inputTokens, outputTokens },
    }
  }

  async countTokens(messages: Message[]): Promise<number> {
    if (messages.length === 0) {
      return 0
    }
    if (this.countTokensApi) {
      try {
        const mapped = mapMessages(messages)
        if (mapped.length > 0) {
          const res = await this.client.messages.countTokens({
            model: this.defaultModel,
            messages: mapped,
          })
          return res.input_tokens
        }
      } catch {
        // endpoint unavailable / transient failure — fall through to estimate
      }
    }
    return estimateTokens(messages)
  }

  withStructuredOutput<T, IncludeRaw extends boolean = false>(
    schema: ZodType<T>,
    options?: StructuredOutputOptions & { includeRaw?: IncludeRaw },
  ): StructuredOutputFn<IncludeRaw extends true ? { raw: Message; parsed: T } : T> {
    const method = options?.method ?? 'functionCalling'
    if (method !== 'functionCalling') {
      throw new NotImplementedError(
        `AnthropicProvider.withStructuredOutput: method '${method}' not supported (only 'functionCalling')`,
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
          model: this.defaultModel,
          messages,
          tools: [descriptor],
          toolChoice: { type: 'tool', name: toolName },
          maxTokens: 1024,
        },
        signal,
      )
      const block = findToolUse(res.message, toolName)
      if (!block) {
        throw new Error(`AnthropicProvider.withStructuredOutput: response did not call tool '${toolName}'`)
      }
      const parsed = schema.parse(block.input)
      return includeRaw ? { raw: res.message, parsed } : parsed
    }

    return fn as StructuredOutputFn<IncludeRaw extends true ? { raw: Message; parsed: T } : T>
  }
}
