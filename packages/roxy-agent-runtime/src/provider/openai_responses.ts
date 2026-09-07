import OpenAI from 'openai'
import type { ClientOptions } from 'openai'
import type {
  Response,
  ResponseCreateParamsNonStreaming,
  ResponseCreateParamsStreaming,
  ResponseCustomToolCall,
  ResponseFunctionToolCall,
  ResponseFunctionWebSearch,
  ResponseInputItem,
  ResponseOutputItem,
  ResponseReasoningItem,
  Tool,
} from 'openai/resources/responses/responses.js'
import type {
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  ContentBlock,
  FileBlock,
  ImageBlock,
  IModelProvider,
  JsonSchema,
  Message,
  ModelUsage,
  RoxyAssistantItem,
  RoxyWebSearchCallItem,
  StopReason,
  StructuredOutputFn,
  StructuredOutputOptions,
  ToolDescriptor,
  ToolResultBlock,
  ToolUseBlock,
} from '../core/interfaces.ts'
import { assistantItemsToContent, assistantItemsToMessage } from '../transcript/items.ts'
import { jsonSchemaToZod, zodToJsonSchema } from '../tools/schema.ts'
import type { ZodType } from 'zod'

const PROVIDER_ID = 'openai-responses'
const DEFAULT_CONTEXT_WINDOW_TOKENS = 262144
const STRUCTURED_OUTPUT_MAX_TOKENS = 4096

type ResponsesReasoning = NonNullable<ResponseCreateParamsNonStreaming['reasoning']>
type ToolKind = 'function' | 'custom'

export interface OpenAIResponsesProviderOptions {
  /** API key already resolved by the host application. */
  apiKey: string
  model: string
  /** Responses-compatible API root. Defaults to the OpenAI API root. */
  baseURL?: string
  defaultHeaders?: Record<string, string>
  contextWindowTokens?: number
  reasoning?: ResponsesReasoning
  topP?: number
  topLogprobs?: number
  user?: string
  /** Provider-executed tools such as web_search. */
  additionalTools?: Tool[]
  /** Local tool names sent as Responses custom tools with free-form text input. */
  customToolNames?: string[]
  /** Test seam matching the existing Anthropic provider pattern. */
  _client?: OpenAI
  /** Optional fetch implementation for custom runtimes and HTTP-level tests. */
  fetch?: ClientOptions['fetch']
}

/** Preserve JSON error envelopes returned by Responses-compatible proxies. */
class ResponsesCompatibleOpenAI extends OpenAI {
  protected override makeStatusError(status: number, error: object, message: string | undefined, headers: Headers) {
    const normalized = error != null && Object.hasOwn(error, 'error') ? error : { error }
    return super.makeStatusError(status, normalized, message, headers)
  }
}

function isFunctionCall(item: ResponseOutputItem): item is ResponseFunctionToolCall {
  return item.type === 'function_call'
}

function isCustomCall(item: ResponseOutputItem): item is ResponseCustomToolCall {
  return item.type === 'custom_tool_call'
}

function isReasoning(item: ResponseOutputItem): item is ResponseReasoningItem {
  return item.type === 'reasoning'
}

function isWebSearchCall(item: ResponseOutputItem): item is ResponseFunctionWebSearch {
  return item.type === 'web_search_call'
}

function mapWebSearchCall(item: ResponseFunctionWebSearch, providerId: string): RoxyWebSearchCallItem {
  return {
    type: 'web_search_call',
    id: item.id,
    status: item.status,
    action: item.action,
    provider: providerId,
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

function toolResultText(content: ToolResultBlock['content']): string {
  return typeof content === 'string' ? content : content.map((block) => block.text).join('\n')
}

type ResponsesMessageContent =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string }
  | { type: 'input_image'; file_id: string }

function mapImageBlock(block: ImageBlock): ResponsesMessageContent {
  return {
    type: 'input_image',
    image_url: `data:${block.mimeType};base64,${block.data}`,
  }
}

function mapFileBlock(block: FileBlock): ResponsesMessageContent {
  return {
    type: 'input_image',
    file_id: block.fileId,
  }
}

function mapMessages(messages: Message[], customToolNames: ReadonlySet<string>): ResponseInputItem[] {
  const input: ResponseInputItem[] = []
  const toolKinds = new Map<string, ToolKind>()

  for (const message of messages) {
    if (message.transcriptItems) {
      for (const item of message.transcriptItems) {
        if (item.type === 'reasoning') {
          input.push({
            type: 'reasoning',
            id: item.id,
            content: item.text ? [{ type: 'reasoning_text', text: item.text }] : [],
            summary: (item.summary ?? []).map((text) => ({ type: 'summary_text', text })),
          } as ResponseInputItem)
        } else if (item.type === 'message') {
          input.push({
            type: 'message',
            role: 'assistant',
            content: item.content.map((block) => ({
              type: 'output_text',
              text: block.text,
              annotations: [],
              logprobs: [],
            })),
          } as unknown as ResponseInputItem)
        } else if (item.type === 'tool_call') {
          toolKinds.set(item.callId, item.toolKind)
          input.push(
            item.toolKind === 'custom'
              ? ({
                  type: 'custom_tool_call',
                  call_id: item.callId,
                  name: item.name,
                  input: typeof item.arguments === 'string' ? item.arguments : JSON.stringify(item.arguments),
                } as ResponseInputItem)
              : ({
                  type: 'function_call',
                  call_id: item.callId,
                  name: item.name,
                  arguments: JSON.stringify(item.arguments),
                } as ResponseInputItem),
          )
        } else if (item.type === 'web_search_call') {
          input.push({
            type: 'web_search_call',
            id: item.id,
            status: item.status ?? 'completed',
            action: item.action,
          } as ResponseInputItem)
        }
      }
      continue
    }

    const role = message.role === 'tool' ? 'user' : message.role
    if (typeof message.content === 'string') {
      input.push({ type: 'message', role, content: message.content } as ResponseInputItem)
      continue
    }

    const pendingContent: ResponsesMessageContent[] = []
    const flushMessageContent = () => {
      if (pendingContent.length === 0) {
        return
      }

      const content = pendingContent.every((block) => block.type === 'input_text')
        ? pendingContent.map((block) => block.text).join('')
        : pendingContent.slice()
      input.push({ type: 'message', role, content } as ResponseInputItem)
      pendingContent.length = 0
    }

    for (const block of message.content) {
      if (block.type === 'text') {
        pendingContent.push({ type: 'input_text', text: block.text })
        continue
      }
      if (block.type === 'image') {
        pendingContent.push(mapImageBlock(block))
        continue
      }
      if (block.type === 'file') {
        pendingContent.push(mapFileBlock(block))
        continue
      }
      flushMessageContent()
      if (block.type === 'thinking') {
        input.push({
          type: 'reasoning',
          id: block.signature,
          content: [{ type: 'reasoning_text', text: block.thinking }],
          summary: [],
        } as ResponseInputItem)
      } else if (block.type === 'tool_use') {
        const kind: ToolKind = customToolNames.has(block.name) ? 'custom' : 'function'
        toolKinds.set(block.id, kind)
        input.push(
          kind === 'custom'
            ? ({
                type: 'custom_tool_call',
                call_id: block.id,
                name: block.name,
                input: typeof block.input === 'string' ? block.input : JSON.stringify(block.input),
              } as ResponseInputItem)
            : ({
                type: 'function_call',
                call_id: block.id,
                name: block.name,
                arguments: JSON.stringify(block.input),
              } as ResponseInputItem),
        )
      } else if (block.type === 'tool_result') {
        input.push(
          toolKinds.get(block.tool_use_id) === 'custom'
            ? ({
                type: 'custom_tool_call_output',
                call_id: block.tool_use_id,
                output: toolResultText(block.content),
              } as ResponseInputItem)
            : ({
                type: 'function_call_output',
                call_id: block.tool_use_id,
                output: toolResultText(block.content),
              } as ResponseInputItem),
        )
      }
    }
    flushMessageContent()
  }
  return input
}

function mapTools(
  descriptors: ToolDescriptor[] | undefined,
  customToolNames: ReadonlySet<string>,
  additionalTools: Tool[],
): Tool[] | undefined {
  const tools: Tool[] = (descriptors ?? []).map((descriptor) => {
    if (customToolNames.has(descriptor.name)) {
      return {
        type: 'custom',
        name: descriptor.name,
        description: descriptor.description,
      } as Tool
    }

    const parameters = zodToJsonSchema(descriptor.inputSchema)
    if (parameters.type !== 'object') {
      throw new Error(
        `OpenAIResponsesProvider: function tool "${descriptor.name}" must serialize to a top-level JSON Schema with type "object"`,
      )
    }

    return {
      type: 'function',
      name: descriptor.name,
      description: descriptor.description,
      parameters,
      strict: false,
    }
  })
  tools.push(...additionalTools)
  return tools.length > 0 ? tools : undefined
}

function mapOutputItems(output: ResponseOutputItem[], providerId: string): RoxyAssistantItem[] {
  const items: RoxyAssistantItem[] = []
  for (const item of output) {
    if (item.type === 'message') {
      const content: Array<{ type: 'output_text'; text: string }> = []
      for (const part of item.content) {
        if (part.type === 'output_text' && part.text) {
          content.push({ type: 'output_text', text: part.text })
        } else if (part.type === 'refusal' && part.refusal) {
          content.push({ type: 'output_text', text: part.refusal })
        }
      }
      if (content.length > 0) {
        items.push({ type: 'message', id: item.id, role: 'assistant', content, provider: providerId })
      }
    } else if (isReasoning(item)) {
      const thinking = item.content?.map((part) => part.text).join('') ?? item.summary.map((part) => part.text).join('')
      items.push({
        type: 'reasoning',
        id: item.id,
        ...(thinking ? { text: thinking } : {}),
        summary: item.summary.map((part) => part.text),
        visibility: thinking ? 'full' : 'summary',
        provider: providerId,
      })
    } else if (isFunctionCall(item)) {
      items.push({
        type: 'tool_call',
        id: item.id ?? item.call_id,
        callId: item.call_id,
        name: item.name,
        arguments: parseJson(item.arguments),
        toolKind: 'function',
        provider: providerId,
      })
    } else if (isCustomCall(item)) {
      items.push({
        type: 'tool_call',
        id: item.id ?? item.call_id,
        callId: item.call_id,
        name: item.name,
        arguments: item.input,
        toolKind: 'custom',
        provider: providerId,
      })
    } else if (isWebSearchCall(item)) {
      items.push(mapWebSearchCall(item, providerId))
    }
  }
  return items
}

function mapUsage(response: Response): ModelUsage {
  return {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    ...(response.usage?.input_tokens_details.cached_tokens !== undefined
      ? { cachedInputTokens: response.usage.input_tokens_details.cached_tokens }
      : {}),
    ...(response.usage?.output_tokens_details.reasoning_tokens !== undefined
      ? { reasoningTokens: response.usage.output_tokens_details.reasoning_tokens }
      : {}),
  }
}

function responseError(response: Response): Error {
  const code = response.error?.code ? `${response.error.code}: ` : ''
  return new Error(`OpenAIResponsesProvider: ${code}${response.error?.message ?? 'response failed'}`)
}

function responseDiagnostics(response: Response): string {
  let textLength = 0
  for (const item of response.output) {
    if (item.type !== 'message') {
      continue
    }
    for (const part of item.content) {
      if (part.type === 'output_text') {
        textLength += part.text.length
      } else if (part.type === 'refusal') {
        textLength += part.refusal.length
      }
    }
  }

  return [
    `status=${response.status}`,
    `outputTokens=${response.usage?.output_tokens ?? 'unknown'}`,
    `reasoningTokens=${response.usage?.output_tokens_details?.reasoning_tokens ?? 'unknown'}`,
    `textLength=${textLength}`,
  ].join(', ')
}

function incompleteError(response: Response): Error {
  const reason = response.incomplete_details?.reason ?? 'unknown'
  return new Error(
    `OpenAIResponsesProvider: incomplete response returned, reason: ${reason} (${responseDiagnostics(response)})`,
  )
}

function mapStopReason(response: Response, blocks: ContentBlock[]): StopReason {
  if (response.status === 'failed') {
    throw responseError(response)
  }
  if (response.status === 'incomplete') {
    throw incompleteError(response)
  }
  return blocks.some((block) => block.type === 'tool_use') ? 'tool_use' : 'end_turn'
}

function responseMessage(response: Response, providerId: string): Message {
  return assistantItemsToMessage(mapOutputItems(response.output, providerId))
}

const JSON_NUMBER_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i

function isJsonSchema(value: unknown): value is JsonSchema {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function valueMatchesJsonSchema(value: unknown, schema: JsonSchema): boolean {
  try {
    return jsonSchemaToZod(schema).safeParse(value).success
  } catch {
    return false
  }
}

/** Coerce only lossless string primitives selected by the caller's JSON Schema. */
function coerceJsonSchemaValue(value: unknown, schema: JsonSchema): unknown {
  if (valueMatchesJsonSchema(value, schema)) {
    return value
  }

  for (const keyword of ['anyOf', 'oneOf'] as const) {
    const alternatives = schema[keyword]
    if (!Array.isArray(alternatives)) {
      continue
    }
    for (const alternative of alternatives) {
      if (!isJsonSchema(alternative)) {
        continue
      }
      const candidate = coerceJsonSchemaValue(value, alternative)
      if (valueMatchesJsonSchema(candidate, alternative)) {
        return candidate
      }
    }
  }

  if (Array.isArray(schema.allOf)) {
    let candidate = value
    for (const part of schema.allOf) {
      if (isJsonSchema(part)) {
        candidate = coerceJsonSchemaValue(candidate, part)
      }
    }
    if (valueMatchesJsonSchema(candidate, schema)) {
      return candidate
    }
  }

  if (Array.isArray(value) && isJsonSchema(schema.items)) {
    return value.map((item) => coerceJsonSchemaValue(item, schema.items as JsonSchema))
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties = isJsonSchema(schema.properties) ? schema.properties : undefined
    const additionalProperties = isJsonSchema(schema.additionalProperties) ? schema.additionalProperties : undefined
    if (properties || additionalProperties) {
      const result = { ...(value as Record<string, unknown>) }
      for (const [key, item] of Object.entries(result)) {
        const propertySchema = properties?.[key]
        const itemSchema = isJsonSchema(propertySchema) ? propertySchema : additionalProperties
        if (itemSchema) {
          result[key] = coerceJsonSchemaValue(item, itemSchema)
        }
      }
      return result
    }
  }

  if (typeof value !== 'string') {
    return value
  }
  const trimmed = value.trim()
  const schemaTypes = Array.isArray(schema.type) ? schema.type : [schema.type]
  const candidates: unknown[] = []
  if (schemaTypes.includes('integer') && JSON_NUMBER_PATTERN.test(trimmed)) {
    const number = Number(trimmed)
    if (Number.isSafeInteger(number)) {
      candidates.push(number)
    }
  }
  if (schemaTypes.includes('number') && JSON_NUMBER_PATTERN.test(trimmed)) {
    const number = Number(trimmed)
    if (Number.isFinite(number)) {
      candidates.push(number)
    }
  }
  if (schemaTypes.includes('boolean')) {
    if (trimmed.toLowerCase() === 'true') {
      candidates.push(true)
    } else if (trimmed.toLowerCase() === 'false') {
      candidates.push(false)
    }
  }
  if (schemaTypes.includes('null') && trimmed.toLowerCase() === 'null') {
    candidates.push(null)
  }
  for (const candidate of candidates) {
    if (valueMatchesJsonSchema(candidate, schema)) {
      return candidate
    }
  }
  return value
}

/** OpenAI Responses wire-protocol implementation of {@link IModelProvider}. */
export class OpenAIResponsesProvider implements IModelProvider {
  readonly id = PROVIDER_ID
  readonly contextWindowTokens: number
  private readonly client: OpenAI
  private readonly model: string
  private readonly reasoning?: ResponsesReasoning
  private readonly topP?: number
  private readonly topLogprobs?: number
  private readonly user?: string
  private readonly additionalTools: Tool[]
  private readonly customToolNames: ReadonlySet<string>
  private readonly baseURL?: string

  constructor(opts: OpenAIResponsesProviderOptions) {
    this.model = opts.model
    this.contextWindowTokens = opts.contextWindowTokens ?? DEFAULT_CONTEXT_WINDOW_TOKENS
    this.reasoning = opts.reasoning
    this.topP = opts.topP
    this.topLogprobs = opts.topLogprobs
    this.user = opts.user
    this.additionalTools = [...(opts.additionalTools ?? [])]
    this.customToolNames = new Set(opts.customToolNames ?? [])
    this.baseURL = opts.baseURL
    this.client =
      opts._client ??
      new ResponsesCompatibleOpenAI({
        apiKey: opts.apiKey,
        ...(opts.baseURL ? { baseURL: opts.baseURL } : {}),
        ...(opts.defaultHeaders ? { defaultHeaders: opts.defaultHeaders } : {}),
        ...(opts.fetch ? { fetch: opts.fetch } : {}),
      })
  }

  private logRequest(_kind: 'invoke' | 'stream' | 'structured', _request: Record<string, unknown>): void {
    // Keep diagnostics useful in packaged Electron logs without leaking tokens,
    // user messages, or tool arguments.
    // const input = request.input
    // const inputItems = Array.isArray(input)
    //   ? input.map((item) => {
    //       if (!item || typeof item !== 'object') {
    //         return typeof item
    //       }
    //       const value = item as Record<string, unknown>
    //       return { type: value.type, role: value.role, name: value.name }
    //     })
    //   : typeof input
    // const tools = request.tools
    // console.warn('[runtime-openai-responses] request', {
    //   kind,
    //   baseURL: this.baseURL,
    //   endpoint: this.baseURL ? `${this.baseURL.replace(/\/$/, '')}/responses` : '/responses',
    //   model: request.model,
    //   stream: request.stream,
    //   max_output_tokens: request.max_output_tokens,
    //   inputType: typeof input,
    //   inputLength: typeof input === 'string' ? input.length : Array.isArray(input) ? input.length : undefined,
    //   inputItems,
    //   toolCount: Array.isArray(tools) ? tools.length : 0,
    //   toolNames: Array.isArray(tools)
    //     ? tools.map((tool) => (tool && typeof tool === 'object' ? (tool as Record<string, unknown>).name : undefined))
    //     : [],
    //   textFormat:
    //     request.text && typeof request.text === 'object' ? (request.text as Record<string, unknown>).format : undefined,
    //   hasInstructions: typeof request.instructions === 'string',
    //   instructionsLength: typeof request.instructions === 'string' ? request.instructions.length : undefined,
    // })
  }

  private logError(kind: 'invoke' | 'stream' | 'structured', error: unknown): void {
    const value = error as
      | { status?: unknown; requestID?: unknown; message?: unknown; headers?: unknown; error?: unknown }
      | undefined
    const headers = value?.headers
    const headerSummary =
      headers && typeof (headers as { get?: unknown }).get === 'function'
        ? {
            requestId: (headers as Headers).get('x-request-id'),
            contentType: (headers as Headers).get('content-type'),
          }
        : undefined
    console.error('[runtime-openai-responses] error', {
      kind,
      status: value?.status,
      requestID: value?.requestID,
      message: value?.message,
      error: value?.error,
      headers: headerSummary,
    })
  }

  toProviderRequest(req: ChatRequest): ResponseCreateParamsNonStreaming {
    const tools = this.mapTools(req.tools)
    return {
      model: req.model || this.model,
      input: this.mapMessages(req.messages),
      store: false,
      stream: false,
      tool_choice: 'auto',
      ...(req.system?.length ? { instructions: req.system.map((block) => block.text).join('\n\n') } : {}),
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      ...(this.reasoning ? { reasoning: this.reasoning } : {}),
      ...(this.topP !== undefined ? { top_p: this.topP } : {}),
      ...(this.topLogprobs !== undefined ? { top_logprobs: this.topLogprobs } : {}),
      ...(this.user ? { user: this.user } : {}),
      ...(tools ? { tools } : {}),
    }
  }

  fromProviderResponse(response: unknown): ChatResponse {
    const value = response as Response
    const items = this.mapOutputItems(value.output)
    const message = assistantItemsToMessage(items)
    return {
      items,
      message,
      stopReason: mapStopReason(value, message.content as ContentBlock[]),
      ...('end_turn' in value && typeof value.end_turn === 'boolean' ? { endTurn: value.end_turn } : {}),
      usage: mapUsage(value),
    }
  }

  private mapTools(descriptors: ToolDescriptor[] | undefined): Tool[] | undefined {
    return mapTools(descriptors, this.customToolNames, this.additionalTools)
  }

  private mapMessages(messages: Message[]): ResponseInputItem[] {
    return mapMessages(messages, this.customToolNames)
  }

  private mapOutputItems(output: ResponseOutputItem[]): RoxyAssistantItem[] {
    return mapOutputItems(output, this.id)
  }

  async invoke(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    const request = this.toProviderRequest(req)
    this.logRequest('invoke', request as unknown as Record<string, unknown>)
    let response: Response
    try {
      response = await this.client.responses.create(request, signal ? { signal } : undefined)
    } catch (error) {
      this.logError('invoke', error)
      throw error
    }
    return this.fromProviderResponse(response)
  }

  async *stream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatStreamChunk> {
    const body: ResponseCreateParamsStreaming = { ...this.toProviderRequest(req), stream: true }
    this.logRequest('stream', body as unknown as Record<string, unknown>)
    let stream: Awaited<ReturnType<OpenAI['responses']['create']>>
    try {
      stream = await this.client.responses.create(body, signal ? { signal } : undefined)
    } catch (error) {
      this.logError('stream', error)
      throw error
    }
    const items = new Map<string, ResponseOutputItem>()
    const emittedTools = new Set<string>()
    const emittedReasoning = new Set<string>()
    const emittedWebSearchStates = new Map<string, string>()
    let terminal = false

    const shouldEmitWebSearch = (item: RoxyWebSearchCallItem): boolean => {
      const state = `${item.status ?? ''}:${JSON.stringify(item.action)}`
      if (emittedWebSearchStates.get(item.id) === state) {
        return false
      }
      emittedWebSearchStates.set(item.id, state)
      return true
    }

    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') {
        yield { type: 'text_delta', text: event.delta }
      } else if (event.type === 'response.reasoning_text.delta') {
        yield { type: 'thinking_delta', text: event.delta }
      } else if (event.type === 'response.reasoning_text.done') {
        if (!emittedReasoning.has(event.item_id)) {
          emittedReasoning.add(event.item_id)
          yield {
            type: 'thinking_block',
            block: { type: 'thinking', thinking: event.text, signature: event.item_id },
          }
        }
      } else if (event.type === 'response.output_item.added') {
        if ('id' in event.item && typeof event.item.id === 'string') {
          items.set(event.item.id, event.item)
        }
        if (isWebSearchCall(event.item)) {
          const item = mapWebSearchCall(event.item, this.id)
          if (shouldEmitWebSearch(item)) {
            yield { type: 'web_search_call', item }
          }
        }
      } else if (event.type === 'response.function_call_arguments.done') {
        const item = items.get(event.item_id)
        if (item && isFunctionCall(item) && !emittedTools.has(item.call_id)) {
          emittedTools.add(item.call_id)
          yield {
            type: 'tool_use',
            block: { type: 'tool_use', id: item.call_id, name: item.name, input: parseJson(event.arguments) },
          }
        }
      } else if (event.type === 'response.custom_tool_call_input.done') {
        const item = items.get(event.item_id)
        if (item && isCustomCall(item) && !emittedTools.has(item.call_id)) {
          emittedTools.add(item.call_id)
          yield {
            type: 'tool_use',
            block: { type: 'tool_use', id: item.call_id, name: item.name, input: event.input },
          }
        }
      } else if (event.type === 'response.output_item.done') {
        const item = event.item
        if ('id' in item && typeof item.id === 'string') {
          items.set(item.id, item)
        }
        if (isFunctionCall(item) && !emittedTools.has(item.call_id)) {
          emittedTools.add(item.call_id)
          yield {
            type: 'tool_use',
            block: { type: 'tool_use', id: item.call_id, name: item.name, input: parseJson(item.arguments) },
          }
        } else if (isCustomCall(item) && !emittedTools.has(item.call_id)) {
          emittedTools.add(item.call_id)
          yield {
            type: 'tool_use',
            block: { type: 'tool_use', id: item.call_id, name: item.name, input: item.input },
          }
        } else if (isWebSearchCall(item)) {
          const mapped = mapWebSearchCall(item, this.id)
          if (shouldEmitWebSearch(mapped)) {
            yield { type: 'web_search_call', item: mapped }
          }
        }
      } else if (
        event.type === 'response.completed' ||
        event.type === 'response.incomplete' ||
        event.type === 'response.failed'
      ) {
        terminal = true
        if (event.response.status === 'failed') {
          throw responseError(event.response)
        }
        if (event.response.status === 'incomplete') {
          throw incompleteError(event.response)
        }
        const responseItems = this.mapOutputItems(event.response.output)
        for (const item of responseItems) {
          if (item.type === 'web_search_call' && shouldEmitWebSearch(item)) {
            yield { type: 'web_search_call', item }
          }
        }
        const blocks = assistantItemsToContent(responseItems)
        for (const block of blocks) {
          if (block.type === 'tool_use' && !emittedTools.has(block.id)) {
            emittedTools.add(block.id)
            yield { type: 'tool_use', block }
          } else if (block.type === 'thinking' && !emittedReasoning.has(block.signature)) {
            emittedReasoning.add(block.signature)
            yield { type: 'thinking_block', block }
          }
        }
        yield {
          type: 'message_stop',
          stopReason: mapStopReason(event.response, blocks),
          ...('end_turn' in event.response && typeof event.response.end_turn === 'boolean'
            ? { endTurn: event.response.end_turn }
            : {}),
          usage: mapUsage(event.response),
          items: responseItems,
        }
      } else if (event.type === 'error') {
        throw new Error(`OpenAIResponsesProvider: ${event.code}: ${event.message}`)
      }
    }

    if (!terminal) {
      throw new Error('OpenAIResponsesProvider: stream ended without a terminal response event')
    }
  }

  countTokens(messages: Message[]): Promise<number> {
    // Count the actual Responses payload, including transcript-only items such
    // as web_search_call and reasoning. Counting only the
    // Anthropic-shaped message blocks can dramatically under-report resumed
    // Conversations and prevent compaction before DeepSeek's hard 400 limit.
    const input = this.mapMessages(messages)
    return Promise.resolve(Math.ceil(JSON.stringify(input).length / 4))
  }

  withStructuredOutput<T, IncludeRaw extends boolean = false>(
    schema: ZodType<T>,
    options: StructuredOutputOptions & { includeRaw?: IncludeRaw } = {},
  ): StructuredOutputFn<IncludeRaw extends true ? { raw: Message; parsed: T } : T> {
    const jsonSchema = zodToJsonSchema(schema)
    const name = options.name ?? 'extract'
    const method = options.method ?? 'jsonSchema'

    return (async (input: string | Message[], signal?: AbortSignal) => {
      const messages: Message[] = typeof input === 'string' ? [{ role: 'user', content: input }] : input
      const request: ResponseCreateParamsNonStreaming = {
        model: this.model,
        input: this.mapMessages(messages),
        max_output_tokens: STRUCTURED_OUTPUT_MAX_TOKENS,
        store: false,
        ...(this.reasoning ? { reasoning: this.reasoning } : {}),
      }

      if (method === 'functionCalling') {
        request.tools = [
          {
            type: 'function',
            name,
            description: 'Return the requested structured data.',
            parameters: jsonSchema as Record<string, unknown>,
            strict: true,
          },
        ]
        request.tool_choice = { type: 'function', name }
      } else if (method === 'jsonMode') {
        request.instructions = `Return one valid json object matching this JSON Schema:\n${JSON.stringify(jsonSchema)}`
        request.text = { format: { type: 'json_object' } }
      } else {
        request.text = {
          format: {
            type: 'json_schema',
            name,
            schema: jsonSchema as Record<string, unknown>,
            strict: true,
          },
        }
      }

      this.logRequest('structured', request as unknown as Record<string, unknown>)
      let response: Response
      try {
        response = await this.client.responses.create(request, signal ? { signal } : undefined)
      } catch (error) {
        this.logError('structured', error)
        throw error
      }
      if (response.status === 'failed') {
        throw responseError(response)
      }
      const raw = responseMessage(response, this.id)
      let value: unknown

      if (method === 'functionCalling') {
        const call = (raw.content as ContentBlock[]).find(
          (block): block is ToolUseBlock => block.type === 'tool_use' && block.name === name,
        )
        if (!call) {
          throw new Error(`OpenAIResponsesProvider.withStructuredOutput: missing function call ${name}`)
        }
        value = call.input
      } else {
        const content = (raw.content as ContentBlock[])
          .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
          .map((block) => block.text)
          .join('')
        if (!content) {
          throw new Error('OpenAIResponsesProvider.withStructuredOutput: empty output text')
        }
        try {
          value = JSON.parse(content) as unknown
        } catch {
          throw new Error(`OpenAIResponsesProvider.withStructuredOutput: invalid JSON: ${content}`)
        }
      }

      const parsed = schema.parse(value)
      return (options.includeRaw ? { raw, parsed } : parsed) as IncludeRaw extends true
        ? { raw: Message; parsed: T }
        : T
    }) as StructuredOutputFn<IncludeRaw extends true ? { raw: Message; parsed: T } : T>
  }

  /**
   * Send a caller-provided JSON Schema without converting it through Zod.
   *
   * Sandbox scripts accept JSON Schema directly, and a JSON Schema -> Zod ->
   * JSON Schema round-trip can change object keywords such as
   * `additionalProperties` into provider-invalid values.
   */
  withJsonSchemaOutput(
    schema: JsonSchema,
    options: {
      name?: string
      method?: 'functionCalling' | 'jsonMode' | 'jsonSchema'
      temperature?: number
      maxTokens?: number
    } = {},
  ): StructuredOutputFn<unknown> {
    const name = options.name ?? 'extract'
    const method = options.method ?? 'jsonSchema'
    const validator = jsonSchemaToZod(schema)

    return (async (input: string | Message[], signal?: AbortSignal) => {
      const messages: Message[] = typeof input === 'string' ? [{ role: 'user', content: input }] : input
      const request: ResponseCreateParamsNonStreaming = {
        model: this.model,
        input: this.mapMessages(messages),
        max_output_tokens: options.maxTokens ?? STRUCTURED_OUTPUT_MAX_TOKENS,
        store: false,
        ...(this.reasoning ? { reasoning: this.reasoning } : {}),
      }

      if (method === 'functionCalling') {
        request.tools = [
          {
            type: 'function',
            name,
            description: 'Return the requested structured data.',
            parameters: schema,
            strict: true,
          },
        ]
        request.tool_choice = { type: 'function', name }
      } else if (method === 'jsonMode') {
        request.instructions = `Return one valid json object matching this JSON Schema:\n${JSON.stringify(schema)}`
        request.text = { format: { type: 'json_object' } }
      } else {
        request.text = {
          format: {
            type: 'json_schema',
            name,
            schema,
            strict: true,
          },
        }
      }
      if (options.temperature !== undefined) {
        request.temperature = options.temperature
      }

      this.logRequest('structured', request as unknown as Record<string, unknown>)
      let response: Response
      try {
        response = await this.client.responses.create(request, signal ? { signal } : undefined)
      } catch (error) {
        this.logError('structured', error)
        throw error
      }
      if (response.status === 'failed') {
        throw responseError(response)
      }
      if (response.status === 'incomplete') {
        throw incompleteError(response)
      }

      let value: unknown
      const raw = responseMessage(response, this.id)
      if (method === 'functionCalling') {
        const call = (raw.content as ContentBlock[]).find(
          (block): block is ToolUseBlock => block.type === 'tool_use' && block.name === name,
        )
        if (!call) {
          throw new Error(`OpenAIResponsesProvider.withJsonSchemaOutput: missing function call ${name}`)
        }
        value = call.input
      } else {
        const content = (raw.content as ContentBlock[])
          .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
          .map((block) => block.text)
          .join('')
        if (!content) {
          throw new Error(
            `OpenAIResponsesProvider.withJsonSchemaOutput: empty output text (${responseDiagnostics(response)})`,
          )
        }
        try {
          value = JSON.parse(content) as unknown
        } catch {
          throw new Error(
            `OpenAIResponsesProvider.withJsonSchemaOutput: invalid JSON (${responseDiagnostics(response)}): ${content}`,
          )
        }
      }
      const parsed = validator.safeParse(coerceJsonSchemaValue(value, schema))
      if (!parsed.success) {
        throw new Error(
          `OpenAIResponsesProvider.withJsonSchemaOutput: output does not match JSON Schema: ${parsed.error.message}`,
        )
      }
      return parsed.data
    }) as StructuredOutputFn<unknown>
  }
}
