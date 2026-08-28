import type { AgentConversationRunEventDTO } from '@roxy/shared/channel'
import type { AgentAttachment, AgentMessage, AgentRunStatus, AgentStream } from './types'

export type ConversationRunEventAppendResult = 'accepted' | 'duplicate' | 'gap'

export interface PendingRunPresentation {
  assistantMessageId: string
  startedAt: number
  userMessageId: string
}

interface CreatePendingRunMessagesOptions {
  attachments: AgentAttachment[]
  content: string
  conversationId: string
  createdAt?: string
  startedAt: number
  token: string
}

interface ConversationDetailRequestState {
  hasMessageCache: boolean
  isKnownConversation: boolean
  isRunning: boolean
}

interface ConversationMessageCachePinState {
  hasActiveRun: boolean
  hasPendingRun: boolean
  hasPreparingRun: boolean
  hasRunningMessage: boolean
  hasStoppedPendingRun: boolean
}

export function shouldRequestConversationDetail(state: ConversationDetailRequestState): boolean {
  return state.isKnownConversation && !state.isRunning && !state.hasMessageCache
}

export function shouldPinConversationMessageCache(state: ConversationMessageCachePinState): boolean {
  return state.hasActiveRun
    || state.hasPendingRun
    || state.hasPreparingRun
    || state.hasRunningMessage
    || state.hasStoppedPendingRun
}

export function createPendingRunMessages(options: CreatePendingRunMessagesOptions): {
  messages: AgentMessage[]
  presentation: PendingRunPresentation
} {
  const userMessageId = `pending-user-${options.token}`
  const assistantMessageId = `pending-assistant-${options.token}`
  const presentation: PendingRunPresentation = {
    assistantMessageId,
    startedAt: options.startedAt,
    userMessageId,
  }

  return {
    presentation,
    messages: [
      {
        id: userMessageId,
        conversationId: options.conversationId,
        role: 'user',
        author: 'You',
        content: options.content,
        attachments: options.attachments,
        createdAt: options.createdAt ?? '',
        status: 'streaming',
      },
      {
        id: assistantMessageId,
        conversationId: options.conversationId,
        role: 'assistant',
        author: 'Roxy AI Agent',
        content: '',
        createdAt: '',
        status: 'streaming',
        process: {
          id: `pending-process-${options.token}`,
          completed: false,
          durationState: 'thinking',
          durationStartedAt: options.startedAt,
          collapsed: false,
          events: [],
        },
      },
    ],
  }
}

export function reconcileConversationRunMessages(
  messages: AgentMessage[],
  presentation: PendingRunPresentation,
  item: AgentConversationRunEventDTO,
): void {
  if (item.event.type !== 'run_started') {
    return
  }

  const userMessage = messages.find(message => message.id === presentation.userMessageId)
  if (userMessage) {
    userMessage.runId = item.runId
    userMessage.status = 'done'
  }

  const assistantMessage = messages.find(message => message.id === presentation.assistantMessageId)
  if (!assistantMessage) {
    return
  }

  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]!
    if (message === assistantMessage || message.role !== 'assistant') {
      continue
    }
    if (message.id === item.assistantMessageId || message.runId === item.runId) {
      messages.splice(index, 1)
    }
  }

  assistantMessage.id = item.assistantMessageId
  assistantMessage.runId = item.runId
  if (assistantMessage.process) {
    assistantMessage.process.id = `pending-process-${item.assistantMessageId}`
    assistantMessage.process.durationStartedAt = presentation.startedAt
  }
}

function eventBlockKey(item: AgentConversationRunEventDTO): string | undefined {
  const { event } = item
  const agentPath = 'agentPath' in event.data && event.data.agentPath
  const workerId = 'workerId' in event.data && event.data.workerId
  const scope = agentPath || workerId || '/root'
  if (event.type === 'thinking_delta') {
    return `${scope}:thinking:${event.data.id ?? event.data.thinkingId}`
  }
  if (event.type === 'content_delta') {
    return `${scope}:content:${event.data.id ?? event.data.contentId}:${event.data.phase ?? ''}`
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

export function appendOrderedConversationRunEvents(
  stream: Pick<AgentStream, 'runId' | 'events' | 'lastSequence'>,
  bufferedEvents: AgentConversationRunEventDTO[],
  item: AgentConversationRunEventDTO,
): { accepted: AgentConversationRunEventDTO[], buffered: AgentConversationRunEventDTO[] } {
  const eventsBySequenceRange = new Map<string, AgentConversationRunEventDTO>()
  for (const candidate of [...bufferedEvents, item]) {
    const startSequence = candidate.startSequence ?? candidate.sequence
    eventsBySequenceRange.set(`${startSequence}:${candidate.sequence}`, candidate)
  }

  const candidates = [...eventsBySequenceRange.values()].sort((left, right) => {
    const startDifference = (left.startSequence ?? left.sequence) - (right.startSequence ?? right.sequence)
    return startDifference || left.sequence - right.sequence
  })
  const accepted: AgentConversationRunEventDTO[] = []

  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index]!
    const result = appendConversationRunEvent(stream, candidate)
    if (result === 'gap') {
      return { accepted, buffered: candidates.slice(index) }
    }
    if (result === 'accepted') {
      accepted.push(candidate)
    }
  }

  return { accepted, buffered: [] }
}

export function appendConversationRunPresentationEvents(
  events: AgentConversationRunEventDTO[],
  items: AgentConversationRunEventDTO[],
): void {
  const lastSequence = events.at(-1)?.sequence ?? 0
  let appendSequence = lastSequence
  const canAppend = items.every((item) => {
    const startSequence = item.startSequence ?? item.sequence
    if (compactedBlockKey(item) || startSequence <= appendSequence) {
      return false
    }
    appendSequence = item.sequence
    return true
  })
  if (canAppend) {
    events.push(...items)
    return
  }

  const sequenceRanges = new Set(events.map((item) => {
    return `${item.startSequence ?? item.sequence}:${item.sequence}`
  }))

  for (const item of items) {
    const blockKey = compactedBlockKey(item)
    if (blockKey) {
      replaceCompactedBlock(events, item, blockKey)
      continue
    }

    const sequenceRange = `${item.startSequence ?? item.sequence}:${item.sequence}`
    if (!sequenceRanges.has(sequenceRange)) {
      events.push(item)
      sequenceRanges.add(sequenceRange)
    }
  }

  events.sort((left, right) => {
    const startDifference = (left.startSequence ?? left.sequence) - (right.startSequence ?? right.sequence)
    return startDifference || left.sequence - right.sequence
  })
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
  if (item.event.type === 'run_completed') {
    return 'completed'
  }
  if (item.event.type === 'run_failed') {
    return 'failed'
  }
  if (item.event.type === 'run_cancelled') {
    return 'cancelled'
  }
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

  hasPending(conversationId: string): boolean {
    return this.pendingByConversation.has(conversationId)
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
      if (!entry || entry.requestId !== requestId) {
        return
      }
      this.entries.delete(conversationId)
      onExpired(entry.value)
    }, timeoutMs)
    this.entries.set(conversationId, { requestId, value, timer })
  }

  acknowledge(conversationId: string, requestId?: string): T | undefined {
    const entry = this.entries.get(conversationId)
    if (!entry || (requestId && entry.requestId !== requestId)) {
      return undefined
    }
    clearTimeout(entry.timer)
    this.entries.delete(conversationId)
    return entry.value
  }

  has(conversationId: string): boolean {
    return this.entries.has(conversationId)
  }

  clear(conversationId: string): void {
    const entry = this.entries.get(conversationId)
    if (!entry) {
      return
    }
    clearTimeout(entry.timer)
    this.entries.delete(conversationId)
  }
}
