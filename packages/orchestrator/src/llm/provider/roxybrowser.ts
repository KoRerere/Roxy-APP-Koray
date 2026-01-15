import { ChatOpenAI } from '@langchain/openai'

export function createRoxyBrowserProvider(enableThinking: boolean) {
  const apiKey = process.env.ROXYBROWSER_API_KEY
  if (!apiKey) {
    throw new Error('ROXYBROWSER_API_KEY environment variable is not set')
  }

  const modelName = process.env.ROXYBROWSER_MODEL || 'gemini-3-pro-high'
  const thinkingBudget = Number.parseInt(process.env.SILICONFLOW_THINKING_BUDGET || '4096', 10)
  const baseURL = process.env.ROXYBROWSER_PROVIDER_BASE_URL || 'https://newapi.chatgpt-ai.pw/v1'

  console.log('[RoxyBrowser Provider] Config:', {
    baseURL,
    modelName,
    enableThinking,
    thinkingBudget,
    apiKeySet: !!apiKey,
  })

  return new ChatOpenAI({
    apiKey,
    configuration: {
      baseURL,
    },
    modelName,
    temperature: 0.5,
    streaming: true,
    modelKwargs: {
      enable_thinking: enableThinking,
      thinking_budget: thinkingBudget,
    },
  })
}
