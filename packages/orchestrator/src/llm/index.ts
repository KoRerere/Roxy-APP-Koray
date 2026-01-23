// import { ChatOpenAI } from "@langchain/openai";
// import { env } from '../config'

// // https://dashscope.aliyuncs.com/compatible-mode/v1
// function createDashScopeProvider(enableThinking: boolean) {
//   const llm = new ChatOpenAI({
//     apiKey: env.LLM_API_KEY,
//     configuration: {
//       baseURL: env.LLM_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
//     },
//     modelName: env.LLM_MODEL || "qwen/qwen-plus",
//     modelKwargs: {
//       enableThinking: enableThinking,
//     },
//     temperature: 0.7,
//     streaming: true,
//   })
//   return llm
// }

// function createSiliconFlowProvider(enableThinking: boolean) {
//   // const thinkingBudget = Number.parseInt(env.SILICONFLOW_THINKING_BUDGET || '4096', 10)
//   const llm = new ChatOpenAI({
//     apiKey: env.LLM_API_KEY,
//     configuration: {
//       baseURL: env.LLM_BASE_URL || "https://api.siliconflow.cn/v1",
//     },
//     modelName: env.LLM_MODEL || 'deepseek-ai/DeepSeek-V3',
//     temperature: 0.7,
//     streaming: true,
//     modelKwargs: {
//       enable_thinking: enableThinking,
//       // thinking_budget: thinkingBudget
//     },
//   })

//   return llm
// }

// function createOpenRouterProvider(enableThinking: boolean) {
//   const llm = new ChatOpenAI({
//     apiKey: env.LLM_API_KEY,
//     configuration: {
//       baseURL: env.LLM_BASE_URL || "https://openrouter.ai/api/v1",
//       defaultHeaders: {
//         "HTTP-Referer": env.SITE_URL || "",
//         "X-Title": env.SITE_NAME || "Orchestrator",
//       }
//     },
//     modelName: env.LLM_MODEL || "anthropic/claude-3.5-sonnet",
//     temperature: 0.7,
//     streaming: true,
//     modelKwargs: {
//       enable_thinking: enableThinking,
//       // thinking_budget: thinkingBudget
//     },
//   });

//   return llm
// }

// /**
//  * 创建 LLM
//  * @param enableThinking 是否开启深度思考模式
//  * @returns 返回对应的 LLM
//  */
// export function createLLM(enableThinking = false) {
//   // 临时强制使用 siliconflow 来测试工具调用
//   const provider = env.LLM_PROVIDER;

//   switch (provider) {
//     case 'openrouter':
//       return createOpenRouterProvider(enableThinking);
//     case 'siliconflow':
//       return createSiliconFlowProvider(enableThinking);
//     case 'dashscope':
//       return createDashScopeProvider(enableThinking);
//     default:
//       return createSiliconFlowProvider(enableThinking);
//   }
// }

import { ChatOpenAI } from '@langchain/openai'
// providerSpec.ts
import { z } from 'zod'
import { env } from '../config'
import { createSiliconFlowLLM } from './provider/siliconFlowChat.js'

export const ProviderSpecSchema = z.object({
  provider: z.enum(['dashscope', 'siliconflow', 'openrouter', 'custom']),
  apiKey: z.string().min(1), // 也可以不下发 key，而是下发 keyId 让服务端代理
  baseURL: z.string().url().optional(),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).default(0.7),
  streaming: z.boolean().default(true),

  // 统一的“能力开关”，由适配器翻译到 modelKwargs
  thinking: z.object({
    enabled: z.boolean().default(false),
    budget: z.number().int().positive().optional(),
  }).default({ enabled: false }),

  // openrouter 这种供应商需要 headers
  headers: z.record(z.string(), z.string()).optional().default({}),
})

export type ProviderSpec = z.infer<typeof ProviderSpecSchema>

function buildModelKwargs(spec: ProviderSpec) {
  const enabled = spec.thinking.enabled
  const budget = spec.thinking.budget

  switch (spec.provider) {
    case 'dashscope':
      return {
        enable_thinking: enabled,
        ...(budget ? { thinking_budget: budget } : {}),
      }

    case 'siliconflow':
      return {
        enable_thinking: enabled,
        ...(budget ? { thinking_budget: budget } : {}),
      }

    case 'openrouter':
      // 注意：OpenRouter 本身并不保证支持 enable_thinking 这类字段，
      // 更多是“模型/厂商自定义参数”。你需要按你实际用的模型确认。
      return {
        enable_thinking: enabled,
        ...(budget ? { thinking_budget: budget } : {}),
      }

    default:
      return {}
  }
}

function resolveBaseURL(spec: ProviderSpec) {
  if (spec.baseURL)
    return spec.baseURL

  switch (spec.provider) {
    case 'dashscope':
      return 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    case 'siliconflow':
      return 'https://api.siliconflow.cn/v1'
    case 'openrouter':
      return 'https://openrouter.ai/api/v1'
  }
}

export function createLLMFromSpec(spec: ProviderSpec) {
  const llm = new ChatOpenAI({
    apiKey: spec.apiKey,
    configuration: {
      baseURL: resolveBaseURL(spec),
      defaultHeaders: spec.headers,
    },
    modelName: spec.model,
    temperature: spec.temperature,
    streaming: spec.streaming,
    modelKwargs: buildModelKwargs(spec),
  })

  return llm
}

function createCustomLLM() {
  console.log('createCustomLLM', {
    apiKey: env.LLM_API_KEY,
    configuration: {
      baseURL: env.LLM_BASE_URL,
    },
    modelName: env.LLM_MODEL!,
  })
  return new ChatOpenAI({
    apiKey: env.LLM_API_KEY,
    configuration: {
      baseURL: env.LLM_BASE_URL,
    },
    modelName: env.LLM_MODEL!,
  })
}

export function createLLM(enableThinking = false) {
  const provider = env.LLM_PROVIDER
  const apiKey = env.LLM_API_KEY
  if (!apiKey) {
    throw new Error('LLM API key is not set')
  }

  if (!provider) {
    throw new Error('LLM provider is not set')
  }

  switch (provider) {
    case 'dashscope':
      return createLLMFromSpec({
        provider: 'dashscope',
        apiKey,
        model: env.LLM_MODEL || 'qwen/qwen-plus',
        temperature: 0.7,
        streaming: true,
        thinking: { enabled: enableThinking },
        headers: {},
      })
    case 'siliconflow':
      return createSiliconFlowLLM(enableThinking)
    case 'openrouter':
      return createLLMFromSpec({
        provider: 'openrouter',
        apiKey,
        model: env.LLM_MODEL || 'anthropic/claude-3.5-sonnet',
        temperature: 0.7,
        streaming: true,
        thinking: { enabled: enableThinking },
        headers: {},
      })
    case 'custom':
      return createCustomLLM()
    default:
      return createLLMFromSpec({
        provider: 'siliconflow',
        apiKey,
        model: env.LLM_MODEL || 'deepseek-ai/DeepSeek-V3',
        temperature: 0.7,
        streaming: true,
        thinking: { enabled: enableThinking },
        headers: {},
      })
  }
}
