import type { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager'
import type { BaseChatModelParams } from '@langchain/core/language_models/chat_models'
import type { BaseMessage, ToolMessage } from '@langchain/core/messages'
import type { ChatResult } from '@langchain/core/outputs'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { AIMessage, ChatMessage } from '@langchain/core/messages'
import { getEnvironmentVariable } from '@langchain/core/utils/env'
import { convertToOpenAITool, isLangChainTool } from '@langchain/core/utils/function_calling'

export type MoonshotMessageRole = 'system' | 'assistant' | 'user' | 'tool'

const TRAILING_SLASHES = /\/+$/

/** 与 OpenAI 兼容：POST 的完整 URL；若传入根路径则补上 `/v1/chat/completions` */
export function resolveMoonshotApiUrl(raw?: string): string {
  if (!raw?.trim())
    return 'https://api.moonshot.cn/v1/chat/completions'
  const t = raw.trim().replace(TRAILING_SLASHES, '')
  if (t.endsWith('/chat/completions'))
    return t
  if (t.endsWith('/v1'))
    return `${t}/chat/completions`
  return `${t}/v1/chat/completions`
}

/** 请求体中的 message：兼容 tool / tool_calls */
interface MoonshotRequestMessage {
  role: MoonshotMessageRole | 'tool'
  content: string | null
  tool_call_id?: string
  tool_calls?: OpenAIToolCallInRequest[]
}

interface OpenAIToolCallInRequest {
  id: string
  type: 'function'
  function: { name: string, arguments: string }
}

/**
 * Interface representing a request for a chat completion.
 *
 * See https://platform.moonshot.cn/docs/intro#%E6%A8%A1%E5%9E%8B%E5%88%97%E8%A1%A8
 */
type ModelName
  = | (string & NonNullable<unknown>)
    | 'moonshot-v1-8k' // context size: 8k
    | 'moonshot-v1-32k' // context size: 32k
    | 'moonshot-v1-128k' // context size: 128k
interface ChatCompletionRequest {
  model: ModelName
  messages?: MoonshotRequestMessage[]
  stream?: boolean
  max_tokens?: number | null
  top_p?: number | null
  temperature?: number | null
  stop?: string[]
  presence_penalty?: number
  frequency_penalty?: number
  n?: number
  tools?: unknown[]
  tool_choice?: unknown
}

interface BaseResponse {
  code?: string
  message?: string
}

interface ChoiceMessage {
  role: string
  content: string | null
  tool_calls?: OpenAIToolCallInResponse[]
}

interface OpenAIToolCallInResponse {
  id?: string
  type?: string
  function?: { name?: string, arguments?: string }
}

interface ResponseChoice {
  index: number
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'null' | null
  delta: ChoiceMessage
  message: ChoiceMessage
}

/**
 * Interface representing a response from a chat completion.
 */
interface ChatCompletionResponse extends BaseResponse {
  choices: ResponseChoice[]
  created: number
  id: string
  model: string
  request_id: string
  usage: {
    completion_tokens: number
    prompt_tokens: number
    total_tokens: number
  }
  output: {
    text: string
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'null' | null
  }
}

/**
 * Interface defining the input to the MoonshotChatInput class.
 */
export interface ChatMoonshotParams {
  /**
   * @default "moonshot-v1-8k"
   * Alias for `model`
   */
  modelName: ModelName
  /**
   * @default "moonshot-v1-8k"
   */
  model: ModelName

  /** Whether to stream the results or not. Defaults to false. */
  streaming?: boolean

  /** Messages to pass as a prefix to the prompt */
  messages?: MoonshotRequestMessage[]

  /**
   * API key to use when making requests. Defaults to the value of
   * `MOONSHOT_API_KEY` environment variable.
   */
  apiKey?: string

  /**
   * 自定义网关：完整 `.../v1/chat/completions` 或与 OpenAI 兼容的根（自动补全路径）。
   * 不传则使用 Moonshot 官方 `https://api.moonshot.cn/v1/chat/completions`。
   */
  apiUrl?: string

  /**
   * Amount of randomness injected into the response. Ranges
   * from 0 to 1 (0 is not included). Use temp closer to 0 for analytical /
   * multiple choice, and temp closer to 1 for creative and generative tasks.
   * Defaults to 0, recommended 0.3
   */
  temperature?: number

  /**
   * Total probability mass of tokens to consider at each step. Range
   * from 0 to 1. Defaults to 1
   */
  topP?: number

  /**
   * Different models have different maximum values. For example, the maximum
   * value of moonshot-v1-8k is 8192. Defaults to 1024
   */
  maxTokens?: number

  stop?: string[]

  /**
   * There is a penalty, a number between -2.0 and 2.0. Positive values
   * penalize the newly generated words based on whether they appear in the
   * text, increasing the likelihood that the model will discuss new topics.
   * The default value is 0
   */
  presencePenalty?: number

  /**
   * Frequency penalty, a number between -2.0 and 2.0. Positive values
   * penalize the newly generated words based on their existing frequency in the
   * text, making the model less likely to repeat the same words verbatim.
   * The default value is 0
   */
  frequencyPenalty?: number

  /**
   * The default value is 1 and cannot be greater than 5. In particular,
   * when temperature is very small and close to 0, we can only return 1 result.
   * If n is already set and > 1, Moonshot will return an invalid input parameter
   * (invalid_request_error).
   */
  n?: number
}

function contentToString(content: BaseMessage['content']): string {
  if (typeof content === 'string')
    return content
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === 'string')
          return block
        if (block && typeof block === 'object' && 'type' in block) {
          if ((block as { type: string }).type === 'text' && 'text' in block)
            return String((block as { text: string }).text)
        }
        return ''
      })
      .join('')
  }
  return String(content ?? '')
}

function mapBaseMessagesToApiFormat(messages: BaseMessage[]): MoonshotRequestMessage[] {
  return messages.map((message) => {
    const type = message._getType()
    switch (type) {
      case 'human':
        return { role: 'user', content: contentToString(message.content) }
      case 'system':
        return { role: 'system', content: contentToString(message.content) }
      case 'ai': {
        const ai = message as AIMessage
        const entry: MoonshotRequestMessage = {
          role: 'assistant',
          content: contentToString(message.content) || null,
        }
        if (ai.tool_calls?.length) {
          entry.tool_calls = ai.tool_calls.map(tc => ({
            id: tc.id ?? '',
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments:
                typeof tc.args === 'string'
                  ? tc.args
                  : JSON.stringify(tc.args ?? {}),
            },
          }))
        }
        return entry
      }
      case 'tool': {
        const tm = message as ToolMessage
        return {
          role: 'tool',
          tool_call_id: tm.tool_call_id,
          content: contentToString(message.content),
        }
      }
      case 'function':
        throw new Error('Legacy function messages are not supported; use tool_calls / ToolMessage')
      case 'generic': {
        if (!ChatMessage.isInstance(message))
          throw new Error('Invalid generic chat message')
        if (['system', 'assistant', 'user'].includes(message.role)) {
          return {
            role: message.role as 'system' | 'assistant' | 'user',
            content: contentToString(message.content),
          }
        }
        throw new Error(`Unknown generic message role: ${message.role}`)
      }
      default:
        throw new Error(`Unsupported message type for Moonshot API: ${type}`)
    }
  })
}

function openAIToolToRequestPayload(tool: unknown): unknown {
  if (isLangChainTool(tool))
    return convertToOpenAITool(tool)
  return tool
}

function safeJsonParseRecord(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s) as Record<string, unknown>
  }
  catch {
    return {}
  }
}

function responseToolCallsToAiMessage(
  toolCalls: OpenAIToolCallInResponse[] | undefined,
): AIMessage['tool_calls'] {
  if (!toolCalls?.length)
    return undefined
  return toolCalls
    .filter(tc => tc.id && tc.function?.name)
    .map(tc => ({
      id: tc.id!,
      name: tc.function!.name!,
      args: safeJsonParseRecord(tc.function!.arguments ?? '{}'),
    }))
}

interface StreamToolAgg {
  id?: string
  name?: string
  args: string
}

interface StreamToolCallDelta {
  index?: number
  id?: string
  type?: string
  function?: { name?: string, arguments?: string }
}

function mergeStreamToolCallDeltas(
  acc: StreamToolAgg[],
  deltas: StreamToolCallDelta[] | undefined,
): void {
  if (!deltas?.length)
    return
  for (const d of deltas) {
    const idx = typeof d.index === 'number' ? d.index : acc.length
    while (acc.length <= idx)
      acc.push({ args: '' })
    const slot = acc[idx]!
    if (d.id)
      slot.id = d.id
    if (d.function?.name)
      slot.name = d.function.name
    if (d.function?.arguments)
      slot.args += d.function.arguments
  }
}

function streamToolAggsToAiToolCalls(acc: StreamToolAgg[]): AIMessage['tool_calls'] | undefined {
  const withName = acc.filter(s => s.name)
  if (!withName.length)
    return undefined
  return withName.map((s, i) => ({
    id: s.id ?? `call_${i}`,
    name: s.name!,
    args: safeJsonParseRecord(s.args),
  }))
}

export class ChatMoonshot extends BaseChatModel implements ChatMoonshotParams {
  static lc_name() {
    return 'ChatMoonshot'
  }

  get callKeys() {
    return ['stop', 'signal', 'options']
  }

  get lc_secrets() {
    return {
      apiKey: 'MOONSHOT_API_KEY',
    }
  }

  get lc_aliases() {
    return undefined
  }

  apiKey?: string

  streaming: boolean

  messages?: MoonshotRequestMessage[]

  modelName: ChatCompletionRequest['model']

  model: ChatCompletionRequest['model']

  apiUrl: string

  maxTokens?: number | undefined

  temperature?: number | undefined

  topP?: number | undefined

  stop?: string[]

  presencePenalty?: number

  frequencyPenalty?: number

  n?: number

  constructor(fields: Partial<ChatMoonshotParams> & BaseChatModelParams = {}) {
    super(fields)

    this.apiKey = fields?.apiKey ?? getEnvironmentVariable('MOONSHOT_API_KEY')

    if (!this.apiKey) {
      throw new Error('Moonshot API key not found')
    }

    this.apiUrl = resolveMoonshotApiUrl(fields.apiUrl)
    this.streaming = fields.streaming ?? false
    this.messages = fields.messages ?? []
    this.temperature = fields.temperature ?? 0
    this.topP = fields.topP ?? 1
    this.stop = fields.stop
    this.maxTokens = fields.maxTokens
    this.modelName = fields?.model ?? fields.modelName ?? 'moonshot-v1-8k'
    this.model = this.modelName
    this.presencePenalty = fields.presencePenalty ?? 0
    this.frequencyPenalty = fields.frequencyPenalty ?? 0
    this.n = fields.n ?? 1
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(): Omit<ChatCompletionRequest, 'messages'> {
    return {
      model: this.model,
      stream: this.streaming,
      temperature: this.temperature,
      top_p: this.topP,
      max_tokens: this.maxTokens,
      stop: this.stop,
      presence_penalty: this.presencePenalty,
      frequency_penalty: this.frequencyPenalty,
      n: this.n,
    }
  }

  /**
   * Get the identifying parameters for the model
   */
  identifyingParams(): Omit<ChatCompletionRequest, 'messages'> {
    return this.invocationParams()
  }

  /**
   * 与 ChatOpenAI 对齐：把工具定义挂到 Runnable 配置里，供 agent / middleware 绑定。
   */
  bindTools(tools: unknown[], kwargs?: Record<string, unknown>) {
    // LangChain Runnable 的 CallOptions 类型未声明 tools，与 ChatOpenAI.bindTools 行为一致
    return this.withConfig({
      tools: tools.map(t => openAIToolToRequestPayload(t)),
      ...kwargs,
    } as Parameters<BaseChatModel['withConfig']>[0])
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    options?: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    const parameters = this.invocationParams()
    const bound = options as { tools?: unknown[], tool_choice?: unknown } | undefined
    const tools = bound?.tools
    const tool_choice = bound?.tool_choice

    const messagesMapped = mapBaseMessagesToApiFormat(messages)

    const requestBody: ChatCompletionRequest = {
      ...parameters,
      messages: messagesMapped,
      ...(Array.isArray(tools) && tools.length > 0
        ? {
            tools,
            ...(tool_choice !== undefined ? { tool_choice } : {}),
          }
        : {}),
    }

    let toolCallsForMessage: AIMessage['tool_calls'] | undefined

    const data = parameters.stream
      ? await new Promise<ChatCompletionResponse>((resolve, reject) => {
          let response: ChatCompletionResponse
          let rejected = false
          let resolved = false
          const streamToolAggs: StreamToolAgg[] = []
          this.completionWithRetry(
            requestBody,
            true,
            options?.signal,
            (event) => {
              const chunk: ChatCompletionResponse = JSON.parse(event.data)
              if (chunk?.code) {
                if (rejected)
                  return
                rejected = true
                reject(new Error(chunk?.message))
                return
              }

              const { delta, finish_reason } = chunk.choices[0]
              const piece = delta.content ?? ''
              mergeStreamToolCallDeltas(
                streamToolAggs,
                delta.tool_calls as StreamToolCallDelta[] | undefined,
              )

              if (!response) {
                response = {
                  ...chunk,
                  output: { text: piece, finish_reason },
                }
              }
              else {
                response.output.text += piece
                response.output.finish_reason = finish_reason
                response.usage = chunk.usage
              }

              void runManager?.handleLLMNewToken(piece)
              if (finish_reason && finish_reason !== 'null') {
                if (resolved || rejected)
                  return
                resolved = true
                toolCallsForMessage = streamToolAggsToAiToolCalls(streamToolAggs)
                resolve(response)
              }
            },
          ).catch((error) => {
            if (!rejected) {
              rejected = true
              reject(error)
            }
          })
        })
      : await this.completionWithRetry(
          requestBody,
          false,
          options?.signal,
        ).then<ChatCompletionResponse>((raw: unknown) => {
          const parsed = raw as ChatCompletionResponse
          if (parsed?.code)
            throw new Error(parsed?.message)
          const choice = parsed.choices[0]
          const { finish_reason, message } = choice
          const text = message.content ?? ''
          toolCallsForMessage = responseToolCallsToAiMessage(message.tool_calls)
          return {
            ...parsed,
            output: { text, finish_reason },
          }
        })

    const {
      prompt_tokens = 0,
      completion_tokens = 0,
      total_tokens = 0,
    } = data.usage ?? {}

    const { text } = data.output

    const message = new AIMessage({
      content: text,
      tool_calls: toolCallsForMessage,
    })

    return {
      generations: [
        {
          text,
          message,
        },
      ],
      llmOutput: {
        tokenUsage: {
          promptTokens: prompt_tokens,
          completionTokens: completion_tokens,
          totalTokens: total_tokens,
        },
      },
    }
  }

  /** @ignore */
  async completionWithRetry(
    request: ChatCompletionRequest,
    stream: boolean,
    signal?: AbortSignal,
    onmessage?: (event: MessageEvent) => void,
  ) {
    const makeCompletionRequest = async () => {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          ...(stream ? { Accept: 'text/event-stream' } : {}),
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal,
      })

      if (!stream) {
        return response.json()
      }

      if (response.body) {
        // response will not be a stream if an error occurred
        if (
          !response.headers.get('content-type')?.startsWith('text/event-stream')
        ) {
          onmessage?.(
            new MessageEvent('message', {
              data: await response.text(),
            }),
          )
          return
        }
        const reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let data = ''
        let continueReading = true
        while (continueReading) {
          const { done, value } = await reader.read()
          if (done) {
            continueReading = false
            break
          }
          data += decoder.decode(value)
          let continueProcessing = true
          while (continueProcessing) {
            const newlineIndex = data.indexOf('\n')
            if (newlineIndex === -1) {
              continueProcessing = false
              break
            }
            const line = data.slice(0, newlineIndex)
            data = data.slice(newlineIndex + 1)
            if (line.startsWith('data:')) {
              const value = line.slice('data:'.length).trim()
              if (value === '[DONE]') {
                continueReading = false
                break
              }
              const event = new MessageEvent('message', { data: value })
              onmessage?.(event)
            }
          }
        }
      }
    }

    return this.caller.call(makeCompletionRequest)
  }

  _llmType(): string {
    return 'moonshot'
  }

  /** @ignore */
  _combineLLMOutput() {
    return []
  }
}
