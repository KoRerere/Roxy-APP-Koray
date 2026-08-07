import type { UserModelInfo } from '../api/agentApiClient'
import type { ChatOpenAICallOptions } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatGoogle } from '@langchain/google'
import { ChatOpenAI } from '@langchain/openai'
import { agentModelApi } from '../api/agentApiClient'
import { aiAgentToken, aiAgentUrl, env } from '../config'

export type LLMInstance = ChatAnthropic | ChatGoogle | ChatOpenAI<ChatOpenAICallOptions>

export const DEEPSEEK_MAX_OUTPUT_TOKENS = 8192
export const DEEPSEEK_THINKING_BUDGET_TOKENS = 4096

export interface CreateLLMOptions {
  enableThinking?: boolean
  conversationId?: string
  turnId?: string
  modelType?: 'text_model' | 'vlm_model'
  isStreaming?: boolean
  signal?: AbortSignal
}

function buildTracingHeaders(options: CreateLLMOptions = {}) {
  return {
    ...(options.conversationId ? { 'Conversation-Id': options.conversationId } : {}),
    ...(options.turnId ? { 'Turn-Id': options.turnId } : {}),
    'ai-agent-version': env.AI_AGENT_VERSION,
  }
}

export function createLLMFromModelInfo(data: UserModelInfo, options: CreateLLMOptions = {}): LLMInstance {
  const baseURL = aiAgentUrl
  const apiKey = aiAgentToken
  const enableThinking = options.enableThinking === true
  const tracingHeaders = buildTracingHeaders(options)

  const modelType = options.modelType ?? 'text_model'
  const selected = data[modelType]
  const model = selected?.model
  const apiFormat = selected?.api_format

  if (!model || !apiFormat) {
    console.error(`invalid model info (${modelType}): `, JSON.stringify(data))
    throw new Error('获取模型信息失败')
  }

  let llm: LLMInstance
  if (apiFormat === 'anthropic') {
    const isDeepSeek = model.toLowerCase().startsWith('deepseek')
    const anthropic = new ChatAnthropic({
      model,
      apiKey,
      ...(isDeepSeek ? { maxTokens: DEEPSEEK_MAX_OUTPUT_TOKENS } : {}),
      anthropicApiUrl: baseURL, // 使用 anthropicApiUrl 设置自定义 API 端点
      streaming: options.isStreaming,
      clientOptions: {
        defaultHeaders: {
          ...tracingHeaders,
        },
      },
      thinking: enableThinking
        ? { type: 'enabled', budget_tokens: DEEPSEEK_THINKING_BUDGET_TOKENS }
        : undefined,
      ...(enableThinking ? {} : { temperature: 0.5 }),
    })

    Object.defineProperty(anthropic, 'profile', {
      value: { maxInputTokens: 1_000_000 }, // TODO: 后续从后端返回
      configurable: true,
    })
    llm = anthropic
  }
  else if (apiFormat === 'openai') {
    llm = new ChatOpenAI({
      modelName: model,
      apiKey,
      configuration: {
        baseURL,
        defaultHeaders: tracingHeaders,
      },
      streaming: options.isStreaming,
      temperature: 0.7,
      modelKwargs: {
        enable_thinking: enableThinking,
      },
    })
  }
  else if (apiFormat === 'google') {
    const url = new URL(baseURL)
    llm = new ChatGoogle(model, {
      apiKey,
      apiClient: {
        hasApiKey: () => Boolean(apiKey),
        getProjectId: async () => '',
        fetch: async (request: Request) => {
          if (apiKey)
            request.headers.set('x-goog-api-key', apiKey)
          for (const [key, value] of Object.entries(tracingHeaders))
            request.headers.set(key, value)
          return fetch(request)
        },
      } as any,
      endpoint: url.host + url.pathname,
      streaming: options.isStreaming,
      temperature: 0.5,
    })
  }
  else {
    throw new Error('当前模型协议不支持')
  }

  return llm
}

/**
 * 创建 LLM
 * @param options 创建 LLM Instance 的选项
 * @returns 返回对应的 LLM
 */
export async function createLLM(options: CreateLLMOptions = {}): Promise<LLMInstance> {
  let data: UserModelInfo
  try {
    data = await agentModelApi.getUserModel({
      headers: buildTracingHeaders(options),
      signal: options.signal,
    })
  }
  catch (error) {
    console.error('failed to fetch model info: ', error)
    throw new Error('获取模型信息失败')
  }
  return createLLMFromModelInfo(data, options)
}
