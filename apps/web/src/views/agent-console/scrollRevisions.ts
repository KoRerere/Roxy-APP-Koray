import type { ProcessRenderItem, ProcessScriptLogGroupItem } from './processEventGrouping'
import type { AgentThinkingProcessEvent } from './types'

function thinkingScrollId(event: AgentThinkingProcessEvent): string {
  return `thinking:${event.id}`
}

function scriptLogGroupScrollId(item: ProcessScriptLogGroupItem): string {
  return `script-grid:${item.id}`
}

export function buildProcessScrollRevisions(
  items: ProcessRenderItem[],
  expandedById: Record<string, boolean>,
): Record<string, string> {
  const revisions: Record<string, string> = {}

  for (const item of items) {
    if (item.type === 'event') {
      if (item.event.type === 'thinking' && expandedById[item.event.id] === true) {
        revisions[thinkingScrollId(item.event)] = `${item.event.status}:${item.event.content.length}`
      }
      continue
    }

    if (item.type === 'script_logs') {
      if (expandedById[item.id] !== true) {
        continue
      }
      const lastEvent = item.events.at(-1)
      const lastLine = lastEvent?.lines.at(-1)
      revisions[scriptLogGroupScrollId(item)] = `${item.events.length}:${lastEvent?.id ?? ''}:${lastEvent?.lines.length ?? 0}:${lastLine?.message.length ?? 0}`
      continue
    }

    if (expandedById[item.id] !== true) {
      continue
    }

    const event = item.events.at(-1)
    if (!event) {
      continue
    }

    let revision = `${item.events.length}:${event.id}`
    if (event.type === 'thinking') {
      revision = `${revision}:${event.content.length}`
    }
    revisions[item.id] = revision
  }

  return revisions
}
