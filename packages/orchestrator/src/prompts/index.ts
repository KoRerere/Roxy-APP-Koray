import type { AllPrompts } from './types'
import { enPrompts } from './en'
import { zhPrompts } from './zh'

/**
 * 获取当前配置的语言（从环境变量）
 * 默认为 'en'
 */
function getPromptsLanguage(): 'zh' | 'en' {
  const lang = process.env.PROMPTS_LANGUAGE?.toLowerCase()

  if (lang === 'zh' || lang === 'zh-cn' || lang === 'chinese') {
    return 'zh'
  }

  // 默认英文
  return 'en'
}

/**
 * 动态导入并返回当前语言的 prompts
 */
function loadPrompts(): AllPrompts {
  const language = getPromptsLanguage()

  if (language === 'zh') {
    return zhPrompts
  }
  else {
    return enPrompts
  }
}

// 创建单例实例
let promptsInstance: AllPrompts | null = null

/**
 * 获取 prompts 实例（单例模式）
 *
 * @returns 当前语言的所有 prompts
 */
export function getPrompts(): AllPrompts {
  if (!promptsInstance) {
    promptsInstance = loadPrompts()
  }
  return promptsInstance
}

/**
 * 重置 prompts 实例（用于测试或动态切换语言）
 */
export function resetPrompts(): void {
  promptsInstance = null
}
