// 定义接口
export interface ILLMChatProvider {
  getAPIConfig: () => { apiKey: string, baseURL: string }
  extractReasoning: (delta: any) => string | undefined
  getThinkingParamKey: () => string
}
