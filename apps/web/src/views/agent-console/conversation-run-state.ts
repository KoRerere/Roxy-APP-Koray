import type { AgentConversationRunEventDTO } from '@roxy/shared/channel'
import type { AgentRunStatus, AgentStream } from './types'

export type ConversationRunEventAppendResult = 'accepted' | 'duplicate' | 'gap'

function eventBlockKey(item: AgentConversationRunEventDTO): string | undefined {
  const { event } = item
  const scope = 'workerId' in event.data && event.data.workerId ? event.data.workerId : ''
  if (event.type === 'thinking_delta') {
    return `${scope}:thinking:${event.data.thinkingId}`
  }
  if (event.type === 'content_delta') {
    return `${scope}:content:${event.data.contentId}:${event.data.phase ?? ''}`
  }
}

function compactedBlockKey(item: AgentConversationRunEventDTO): string | undefined {
  return item.startSequence === undefined ? undefined : eventBlockKey(item)
}

function replaceCompactedBlock(
  events: AgentConversationRunEventDTO[],
  item: AgentConversationRunEventDTO,
  key: string,
): void {
  let insertAt = events.length
  for (let index = events.length - 1; index >= 0; index--) {
    const existing = events[index]!
    if (eventBlockKey(existing) === key) {
      insertAt = index
      events.splice(index, 1)
    }
  }

  events.splice(insertAt, 0, item)
}

export function appendConversationRunEvent(
  stream: Pick<AgentStream, 'runId' | 'events' | 'lastSequence'>,
  item: AgentConversationRunEventDTO,
): ConversationRunEventAppendResult {
  if (item.runId !== stream.runId) {
    return 'gap'
  }
  const startSequence = item.startSequence ?? item.sequence
  const blockKey = compactedBlockKey(item)
  if (item.sequence <= stream.lastSequence) {
    if (blockKey) {
      replaceCompactedBlock(stream.events, item, blockKey)
      return 'accepted'
    }
    return 'duplicate'
  }
  if (startSequence > stream.lastSequence + 1 || startSequence > item.sequence) {
    return 'gap'
  }

  if (blockKey) {
    replaceCompactedBlock(stream.events, item, blockKey)
  }
  else {
    stream.events.push(item)
  }
  stream.lastSequence = item.sequence
  return 'accepted'
}

export function replaceConversationRunEvents(
  stream: Pick<AgentStream, 'runId' | 'events' | 'lastSequence'>,
  events: AgentConversationRunEventDTO[],
): boolean {
  const sorted = [...events]
    .filter(item => item.runId === stream.runId)
    .sort((a, b) => (a.startSequence ?? a.sequence) - (b.startSequence ?? b.sequence))
  let previous = 0
  for (const item of sorted) {
    const startSequence = item.startSequence ?? item.sequence
    if (startSequence !== previous + 1 || startSequence > item.sequence) {
      return false
    }
    previous = item.sequence
  }

  if (
    stream.lastSequence > previous
    || (stream.lastSequence === previous && stream.events.length >= sorted.length)
  ) {
    return true
  }

  stream.events = sorted
  stream.lastSequence = previous
  return true
}

export function terminalRunStatus(item: AgentConversationRunEventDTO): AgentRunStatus | undefined {
  if (item.event.type === 'run_completed')
    return 'completed'
  if (item.event.type === 'run_failed')
    return 'failed'
  if (item.event.type === 'run_cancelled')
    return 'cancelled'
}

interface ConversationRunSummary {
  latestRunId?: string
  latestRunStatus?: AgentRunStatus
  runningRunIds: string[]
}

export function reconcileConversationRunSummary(
  existing: ConversationRunSummary | undefined,
  incoming: ConversationRunSummary,
  locallyStopped: boolean,
): ConversationRunSummary {
  const latestRunId = incoming.latestRunId ?? existing?.latestRunId
  const latestRunStatus = locallyStopped
    ? 'cancelled'
    : incoming.latestRunStatus ?? existing?.latestRunStatus
  const runningRunIds = latestRunStatus === 'queued' || latestRunStatus === 'streaming'
    ? latestRunId
      ? [latestRunId]
      : existing?.runningRunIds ?? []
    : []

  return { latestRunId, latestRunStatus, runningRunIds }
}

export class LocallyStoppedConversationRunRegistry<T> {
  private readonly runIds = new Set<string>()
  private readonly pendingByConversation = new Map<string, { requestId: string, value: T }>()

  addRun(runId: string): void {
    this.runIds.add(runId)
  }

  addPending(conversationId: string, requestId: string, value: T): void {
    this.pendingByConversation.set(conversationId, { requestId, value })
  }

  resolve(item: AgentConversationRunEventDTO): T | undefined {
    if (item.event.type !== 'run_started') {
      return undefined
    }

    const pending = this.pendingByConversation.get(item.conversationId)
    if (!pending) {
      return undefined
    }

    this.pendingByConversation.delete(item.conversationId)
    if (pending.requestId !== item.event.data.requestId) {
      return undefined
    }

    this.runIds.add(item.runId)
    return pending.value
  }

  hasRun(runId: string): boolean {
    return this.runIds.has(runId)
  }

  removeConversation(conversationId: string, runIds: string[]): void {
    this.pendingByConversation.delete(conversationId)
    for (const runId of runIds) {
      this.runIds.delete(runId)
    }
  }
}

interface PendingEntry<T> {
  requestId: string
  value: T
  timer: ReturnType<typeof setTimeout>
}

export class PendingConversationRunRegistry<T> {
  private readonly entries = new Map<string, PendingEntry<T>>()

  begin(
    conversationId: string,
    requestId: string,
    value: T,
    timeoutMs: number,
    onExpired: (value: T) => void,
  ): void {
    this.clear(conversationId)
    const timer = setTimeout(() => {
      const entry = this.entries.get(conversationId)
      if (!entry || entry.requestId !== requestId)
        return
      this.entries.delete(conversationId)
      onExpired(entry.value)
    }, timeoutMs)
    this.entries.set(conversationId, { requestId, value, timer })
  }

  acknowledge(conversationId: string, requestId?: string): T | undefined {
    const entry = this.entries.get(conversationId)
    if (!entry || (requestId && entry.requestId !== requestId))
      return undefined
    clearTimeout(entry.timer)
    this.entries.delete(conversationId)
    return entry.value
  }

  has(conversationId: string): boolean {
    return this.entries.has(conversationId)
  }

  clear(conversationId: string): void {
    const entry = this.entries.get(conversationId)
    if (!entry)
      return
    clearTimeout(entry.timer)
    this.entries.delete(conversationId)
  }
}
