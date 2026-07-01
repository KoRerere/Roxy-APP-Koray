import { env } from '@/config'

export function buildParallelToolCallLimitMessage(toolName: string): string {
  if (env.SYSTEM_LANGUAGE === 'zh-CN') {
    return [
      `## ${toolName} 不允许并行调用`,
      '',
      `${toolName} 必须单独调用，不能与同一轮中的其他工具调用混在一起。`,
      `请在下一轮把 ${toolName} 作为唯一工具调用重新执行。`,
    ].join('\n')
  }

  return [
    `## ${toolName} parallel call not allowed`,
    '',
    `${toolName} must be called alone, without any other tool calls in the same turn.`,
    `Call ${toolName} again as the only tool call in the next turn.`,
  ].join('\n')
}
