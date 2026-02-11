import { ChatOpenAI } from '@langchain/openai'
import { env } from '../config'
import { ChatGPT, Claude, DeepSeek, Gemini, Qwen, SiliconFlowDeepSeek } from './model'
import { providerBaseURL } from './provider'

/**
 * 创建 LLM
 * @param enableThinking 是否开启深度思考模式
 * @returns 返回对应的 LLM
 */
export function createLLM(enableThinking = false) {
  const provider = env.LLM_PROVIDER
  const baseURL = providerBaseURL[provider as keyof typeof providerBaseURL]
  const apiKey = env.LLM_API_KEY
  const model = env.LLM_MODEL.toLowerCase()

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
      temperature: 0.7,
      clientOptions: {
        defaultHeaders: {
          'anthropic-version': '2023-06-01',
        },
      },
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
