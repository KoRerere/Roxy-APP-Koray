import { ChatOpenAI } from '@langchain/openai'
import { env } from '../config'
import { ChatGPT, Claude, DeepSeek, Gemini, Kimi, Qwen, SiliconFlowDeepSeek } from './model'

/**
 * 创建 LLM
 * @param enableThinking 是否开启深度思考模式
 * @returns 返回对应的 LLM
 */
export function createLLM(enableThinking = false) {
  const provider = env.LLM_PROVIDER
  const baseURL = env.LLM_BASE_URL
  const apiKey = env.ROXY_API_KEY
  const model = env.LLM_MODEL

  if (provider === 'siliconflow' && model.includes('deepseek')) {
    const config = {
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
    }
    return new SiliconFlowDeepSeek(config)
  }
  else if (model.includes('deepseek')) {
    const config = {
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
    }
    return new DeepSeek(config)
  }
  else if (model.includes('qwen')) {
    // 通义千问
    const config = {
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
    }
    return new Qwen(config)
  }
  else if (model.includes('claude')) {
    // ChatAnthropic 需要使用 anthropicApiUrl 而不是 configuration.baseURL
    const config = {
      model,
      apiKey,
      anthropicApiUrl: baseURL, // 使用 anthropicApiUrl 设置自定义 API 端点
      streaming: true,
      maxTokens: 4096 + 1024,
      thinking: enableThinking
        ? { type: 'enabled', budget_tokens: 4096 }
        : undefined,
      ...(enableThinking ? {} : { temperature: 0.5 }),
    }
    return new Claude(config)
  }
  else if (model.includes('gemini')) {
    const config = {
      modelName: model,
      apiKey,
      configuration: {
        baseURL,
      },
      streaming: true,
      temperature: 0.7,
    }
    return new Gemini(config)
  }
  else if (model.includes('gpt')) {
    const config = {
      modelName: model,
      apiKey,
      configuration: {
        baseURL,
      },
      streaming: true,
      temperature: 0.7,
    }

    return new ChatGPT(config)
  }
  else if (model.includes('kimi')) {
    return new Kimi({
      model,
      apiKey,
      apiUrl: baseURL,
      streaming: true,
      temperature: 0.5,
    })
  }
  else {
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
}
