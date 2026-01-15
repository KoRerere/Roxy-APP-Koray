import type { BaseMessage } from '@langchain/core/messages'
import { AIMessageChunk } from '@langchain/core/messages'
import { ChatGenerationChunk } from '@langchain/core/outputs'
import { ChatOpenAI } from '@langchain/openai'
import OpenAI from 'openai'
import type { ILLMChatProvider } from './baseLLMChat'

export function createSiliconFlowProvider(enableThinking: boolean) {
  const thinkingBudget = Number.parseInt(process.env.SILICONFLOW_THINKING_BUDGET || '4096', 10)
  return new ChatOpenAI({
    modelName: process.env.SILICONFLOW_MODEL || 'deepseek-ai/DeepSeek-V3',
    apiKey: process.env.SILICONFLOW_API_KEY!,
    configuration: {
      baseURL: process.env.SILICONFLOW_PROVIDER_BASE_URL || 'https://api.siliconflow.cn/v1',
    },
    modelKwargs: {
      enable_thinking: enableThinking,
      thinking_budget: thinkingBudget,
    },
    temperature: 0.7,
    streaming: true,
  })

  // const baseModel = process.env.SILICONFLOW_MODEL || 'deepseek-ai/DeepSeek-V3'
  // const thinkingBudget = Number.parseInt(process.env.SILICONFLOW_THINKING_BUDGET || '4096', 10)

  // const config: any = {
  //   modelName: baseModel,
  //   apiKey: process.env.SILICONFLOW_API_KEY,
  //   configuration: {
  //     baseURL: 'https://api.siliconflow.cn/v1',
  //   },
  //   streaming: true,
  //   temperature: 0.7,
  // }

  // // SiliconFlow thinking configuration
  // if (enableThinking) {
  //   config.enable_thinking = true
  //   config.modelKwargs = {
  //     enable_thinking: true,
  //     thinking_budget: thinkingBudget,
  //   }
  // }

  // return new SiliconFlowChat(config);
}
