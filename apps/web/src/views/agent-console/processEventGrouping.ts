import type {
  AgentContentProcessEvent,
  AgentLifecycleProcessEvent,
  AgentProcessEvent,
  AgentScriptLogProcessEvent,
} from './types'

export interface ProcessContentItem {
  type: 'content'
  event: AgentContentProcessEvent
}

export interface ProcessEventItem {
  type: 'event'
  event: AgentProcessEvent
}

export interface ProcessEventGroupItem {
  type: 'group'
  id: string
  events: AgentProcessEvent[]
}

export interface ProcessScriptLogGroupItem {
  type: 'script_logs'
  id: string
  events: AgentScriptLogProcessEvent[]
}

export type ProcessRenderItem = ProcessContentItem | ProcessEventItem | ProcessEventGroupItem | ProcessScriptLogGroupItem

function isSpawnAgentEvent(event: AgentProcessEvent): boolean {
  return event.type === 'tool_call'
    && (event.toolName === 'spawn_agent' || event.toolName.endsWith('__spawn_agent'))
}

interface ProcessEventsBlock {
  type: 'events'
  id: string
  events: AgentProcessEvent[]
}

interface ProcessAgentLifecycleBlock {
  type: 'agent_lifecycle'
  id: string
  event: AgentLifecycleProcessEvent
}

type ProcessEventBlock = ProcessEventsBlock | ProcessAgentLifecycleBlock

export function getProcessGroupPrimaryEvent(events: AgentProcessEvent[]): AgentProcessEvent | undefined {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]
    if (event.type !== 'thinking') {
      return event
    }
  }

  return events.at(-1)
}

function isSameScriptLogBatch(
  event: AgentProcessEvent,
  first: AgentScriptLogProcessEvent,
): event is AgentScriptLogProcessEvent {
  return event.type === 'script_log'
    && Boolean(first.toolId)
    && event.toolId === first.toolId
}

export function groupProcessEvents(events: AgentProcessEvent[], scope = 'root'): ProcessRenderItem[] {
  const items: ProcessRenderItem[] = []
  let group: AgentProcessEvent[] = []

  function flushGroup(): void {
    if (group.length === 0) {
      return
    }

    if (group.length === 1) {
      items.push({ type: 'event', event: group[0] })
    }
    else {
      items.push({
        type: 'group',
        id: `event-group-${scope}-${group[0].id}`,
        events: group,
      })
    }
    group = []
  }

  for (let index = 0; index < events.length;) {
    const event = events[index]
    if (event.type === 'content') {
      flushGroup()
      if (event.content.trim()) {
        items.push({ type: 'content', event })
      }
      index += 1
      continue
    }

    if (event.type === 'script_log') {
      const batch = [event]
      let nextIndex = index + 1
      while (nextIndex < events.length && isSameScriptLogBatch(events[nextIndex], event)) {
        batch.push(events[nextIndex])
        nextIndex += 1
      }
      if (batch.length === 1) {
        group.push(event)
        index += 1
      }
      else {
        flushGroup()
        items.push({ type: 'script_logs', id: event.id, events: batch })
        index = nextIndex
      }
      continue
    }

    if (isSpawnAgentEvent(event)) {
      flushGroup()
      items.push({ type: 'event', event })
      index += 1
      continue
    }

    if (event.type === 'context_compacted' || event.type === 'retrying' || event.type === 'agent_lifecycle' || event.type === 'hitl') {
      flushGroup()
      items.push({ type: 'event', event })
      index += 1
      continue
    }

    group.push(event)
    index += 1
  }

  flushGroup()
  return items
}

export function splitProcessEventBlocks(events: AgentProcessEvent[], scope = 'root'): ProcessEventBlock[] {
  const blocks: ProcessEventBlock[] = []
  let blockEvents: AgentProcessEvent[] = []
  let sequence = 0

  function flushEvents(): void {
    if (blockEvents.length === 0) {
      return
    }
    blocks.push({
      type: 'events',
      id: `${scope}-events-${sequence++}-${blockEvents[0].id}`,
      events: blockEvents,
    })
    blockEvents = []
  }

  for (const event of events) {
    if (event.type === 'agent_lifecycle') {
      flushEvents()
      blocks.push({ type: 'agent_lifecycle', id: event.id, event })
    }
    else {
      blockEvents.push(event)
    }
  }

  flushEvents()
  return blocks
}
