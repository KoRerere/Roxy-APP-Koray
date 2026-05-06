import { ChatAnthropic } from '@langchain/anthropic'
import { ChatGoogle } from '@langchain/google'
import { ChatOpenAI } from '@langchain/openai'
import { env } from '../config'
import { ChatMoonshot } from './model/moonshot'

/**
 * 创建 LLM
 * @param enableThinking 是否开启深度思考模式
 * @returns 返回对应的 LLM
 */
export async function createLLM(enableThinking = false) {
  const baseURL = env.ENV_TYPE === 'production' ? 'https://roxybrowser.com/llm-proxy' : 'https://apitest.roxybrowser.co/llm-proxy'
  const apiKey = env.ROXY_API_KEY
  const response = await fetch(`${baseURL}/v1/user/model`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })
  const result: any = await response.json()
  let model = ''
  let protocol = 'anthropic'
  if (result.success) {
    model = result.data.model
    protocol = result.data.protocol
  }

  if (protocol === 'anthropic') {
    return new ChatAnthropic({
      model,
      apiKey,
      anthropicApiUrl: baseURL, // 使用 anthropicApiUrl 设置自定义 API 端点
      streaming: true,
      maxTokens: 4096 + 1024,
      thinking: enableThinking
        ? { type: 'enabled', budget_tokens: 4096 }
        : undefined,
      ...(enableThinking ? {} : { temperature: 0.5 }),
    })
  }
  else if (protocol === 'openai') {
    return new ChatOpenAI({
      modelName: model,
      apiKey,
      configuration: {
        baseURL,
      },
      streaming: true,
      temperature: 0.7,
      modelKwargs: {
        enable_thinking: enableThinking,
      },
    })
  }
  else if (protocol === 'google') {
    const url = new URL(baseURL)
    return new ChatGoogle(model, {
      apiKey,
      endpoint: url.host + url.pathname,
      streaming: true,
      temperature: 0.5,
    })
  }
  else if (protocol === 'moonshot') {
    return new ChatMoonshot({
      model,
      streaming: true,
      apiKey,
      apiUrl: baseURL,
    })
  }
  else {
    throw new Error('当前模型协议不支持')
  }
}
