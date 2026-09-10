import type { AgentProcessEvent, AgentProcessEventStatus } from './types'

export type AgentRetryIconName = 'base/rx_ic_wifi' | 'base/rx_ic_wifi2'

export function retryIconName(status: AgentProcessEventStatus | undefined): AgentRetryIconName {
  return status === 'running' ? 'base/rx_ic_wifi2' : 'base/rx_ic_wifi'
}

export function markProcessEventsStopped(events: AgentProcessEvent[]): void {
  for (const event of events) {
    if (event.status === 'running' || event.status === 'pending') {
      event.status = 'failed'
    }

    if (event.type === 'agent_lifecycle') {
      if (event.lifecycleStatus === 'starting' || event.lifecycleStatus === 'running') {
        event.lifecycleStatus = 'cancelled'
      }
      markProcessEventsStopped(event.events)
      markProcessEventsStopped(event.children)
    }
  }
}
