import type { AgentMessageStatus, AgentProcessEvent } from './types'

export function shouldCollapseProcessBeforeTaskReport(
  events: readonly AgentProcessEvent[],
  messageStatus?: AgentMessageStatus,
): boolean {
  return messageStatus === 'done' && events.at(-1)?.type === 'task_report'
}
