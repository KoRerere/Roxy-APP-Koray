import { env } from '@/config'
import { ROXY_ASSISTANT_PROMPT_EN } from './en/assistant'
import { PARALLEL_DISPATCH_RULES_EN } from './en/parallelDispatch'
import { ROXY_WORKER_PROMPT_EN } from './en/profileWorker'
import { ROXY_ASSISTANT_PROMPT_ZH } from './zh/assistant'
import { PARALLEL_DISPATCH_RULES_ZH } from './zh/parallelDispatch'
import { ROXY_WORKER_PROMPT_ZH } from './zh/profileWorker'

export { workerNames } from './constants'

export function appendRecordingContext(systemPrompt: string, recordingPath?: string): string {
  if (!recordingPath)
    return systemPrompt

  const context = env.SYSTEM_LANGUAGE === 'zh-CN'
    ? `## 可用上下文文件\n\n- 浏览器操作记录：\`${recordingPath}\`。包含当前会话实际执行过的浏览器工具调用，可用于辅助编写符合用户需求的自动化脚本。`
    : `## Available Context Files\n\n- Browser operation record: \`${recordingPath}\`. It contains browser tool calls actually executed in the current conversation and can help author an automation script that matches the user's requirements.`

  return `${systemPrompt}\n\n${context}`
}

/** Roxy 通用助手系统提示（随 SYSTEM_LANGUAGE 切换） */
export const ROXY_ASSISTANT_PROMPT
  = env.SYSTEM_LANGUAGE === 'zh-CN' ? ROXY_ASSISTANT_PROMPT_ZH : ROXY_ASSISTANT_PROMPT_EN

/** 主对话系统提示：通用助手能力 + 多窗口分派规则 */
export const ROXY_MAIN_SYSTEM_PROMPT
  = env.SYSTEM_LANGUAGE === 'zh-CN'
    ? `${ROXY_ASSISTANT_PROMPT_ZH}\n\n${PARALLEL_DISPATCH_RULES_ZH}`
    : `${ROXY_ASSISTANT_PROMPT_EN}\n\n${PARALLEL_DISPATCH_RULES_EN}`

/** Claw / IM 对话系统提示：不包含 parallel_dispatch 分派规则 */
export const ROXY_CLAW_SYSTEM_PROMPT = ROXY_ASSISTANT_PROMPT

/** parallel_dispatch 派生 Worker 系统提示（与语言环境一致） */
export const ROXY_WORKER_SYSTEM_PROMPT
  = env.SYSTEM_LANGUAGE === 'zh-CN' ? ROXY_WORKER_PROMPT_ZH : ROXY_WORKER_PROMPT_EN
