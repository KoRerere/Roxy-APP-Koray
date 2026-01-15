import { ChatOpenAI } from '@langchain/openai'
import { ILLMChatProvider } from './baseLLMChat'

export function createOpenRouterProvider(enableThinking: boolean) {
  return new ChatOpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.SITE_URL || '',
        'X-Title': process.env.SITE_NAME || 'Orchestrator',
      },
    },
    modelName: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
    temperature: 0.7,
    streaming: true,
  })
}

// class OpenRouterProvider extends ChatOpenAI implements ILLMChatProvider {
//   protected _reasoningStarted: boolean = false;

//   getAPIConfig() {
//     return {
//         apiKey: process.env.OPENROUTER_API_KEY!,
//         baseURL: "https://openrouter.ai/api/v1",
//         defaultHeaders: {
//           "HTTP-Referer": process.env.SITE_URL || "",
//           "X-Title": process.env.SITE_NAME || "Orchestrator",
//         }
//     };
//   }
// }
