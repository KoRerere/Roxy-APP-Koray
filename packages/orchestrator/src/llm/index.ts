import { createOpenRouterProvider } from './provider/openRouter'
import { createRoxyBrowserProvider } from './provider/roxybrowser'
import { createSiliconFlowProvider } from './provider/siliconFlow'

/**
 * 创建 LLM
 * @param enableThinking 是否开启深度思考模式
 * @returns 返回对应的 LLM
 */
export function createLLM(enableThinking = false) {
  // 临时强制使用 OpenRouter 来测试工具调用
  const provider = process.env.LLM_PROVIDER || 'openrouter'

  switch (provider) {
    case 'openrouter':
      return createOpenRouterProvider(enableThinking)
    case 'siliconflow':
      return createSiliconFlowProvider(enableThinking)
    case 'roxybrowser':
      return createRoxyBrowserProvider(enableThinking)
    default:
      return createSiliconFlowProvider(enableThinking)
  }
}
