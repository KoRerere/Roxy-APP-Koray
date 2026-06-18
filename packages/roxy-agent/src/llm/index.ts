import type { UserModelInfo } from '../api/model'
import type { ChatOpenAICallOptions } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatGoogle } from '@langchain/google'
import { ChatOpenAI } from '@langchain/openai'
import { aiAgentModelApi } from '../api/model'
import { aiAgentToken, aiAgentUrl, env } from '../config'

export type LLMInstance = ChatAnthropic | ChatGoogle | ChatOpenAI<ChatOpenAICallOptions>

export interface CreateLLMOptions {
  enableThinking?: boolean
  conversationId?: string
  turnId?: string
  /** 指定使用的模型类型：生成图片用 vlm_model，其他全部用 text_model（默认） */
  modelType?: 'text_model' | 'vlm_model'
  isStreaming?: boolean
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
    llm = new ChatAnthropic({
      model,
      apiKey,
      anthropicApiUrl: baseURL, // 使用 anthropicApiUrl 设置自定义 API 端点
      streaming: options.isStreaming,
      maxTokens: 4096 + 1024,
      clientOptions: {
        defaultHeaders: {
          ...tracingHeaders,
        },
      },
      thinking: enableThinking
        ? { type: 'enabled', budget_tokens: 4096 }
        : undefined,
      ...(enableThinking ? {} : { temperature: 0.5 }),
    })
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
 * @param enableThinking 是否开启深度思考模式
 * @returns 返回对应的 LLM
 */
export async function createLLM(options: CreateLLMOptions = {}): Promise<LLMInstance> {
  let data: UserModelInfo
  try {
    data = await aiAgentModelApi.getUserModel({
      headers: buildTracingHeaders(options),
    })
  }
  catch (error) {
    console.error('failed to fetch model info: ', error)
    throw new Error('获取模型信息失败')
  }
  return createLLMFromModelInfo(data, options)
}
