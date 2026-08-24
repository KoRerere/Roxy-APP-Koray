import type {
  AgentConversationRunEventDTO,
  AgentRunEvent,
  AgentRunEventMap,
} from '@roxy/shared/channel'
import { withAgentPath } from './events'

export interface RunIdentity {
  conversationId: string
  runId: string
  turnId: string
  assistantMessageId: string
}

export interface BeginRunInput extends RunIdentity {
  requestId?: string
  source: AgentRunEventMap['run_started']['source']
  startedAt?: number
}

type RunEventListener = (event: AgentConversationRunEventDTO) => void

type FragmentEvent = AgentRunEvent<'thinking_delta'> | AgentRunEvent<'content_delta'>

type LiveEventPersistence = 'pending' | 'deferred' | 'retry' | 'persisted' | 'discarded'

interface LiveEventEntry {
  completion?: LiveEventEntry
  item: AgentConversationRunEventDTO
  key?: string
  persistence: LiveEventPersistence
  scope: string
  span: number
  type?: FragmentEvent['type']
}

const TERMINAL_TYPES = new Set<AgentRunEvent['type']>([
  'run_completed',
  'run_failed',
  'run_cancelled',
])

export class RunEventPublisher {
  private sequence = 0
  private terminal = false
  private terminalStatusValue: 'completed' | 'failed' | 'cancelled' | undefined
  private approvalId: string | undefined
  private readonly liveEvents: LiveEventEntry[] = []
  private readonly activeBlocks = new Map<string, LiveEventEntry>()
  private readonly pendingBlocks = new Set<LiveEventEntry>()
  private readonly retryBlocksByScope = new Map<string, LiveEventEntry[]>()
  private readonly retriedScopes = new Set<string>()

  constructor(
    readonly identity: RunIdentity,
    private readonly hub: RunEventHub,
  ) {}

  get isTerminal(): boolean {
    return this.terminal
  }

  get terminalStatus(): 'completed' | 'failed' | 'cancelled' | undefined {
    return this.terminalStatusValue
  }

  get pendingApprovalId(): string | undefined {
    return this.approvalId
  }

  getLiveEvents(): AgentConversationRunEventDTO[] {
    let sequence = 0

    return this.liveEvents.map((entry) => {
      const startSequence = sequence + 1
      sequence += entry.span

      return {
        ...entry.item,
        startSequence: entry.span > 1 ? startSequence : undefined,
        sequence,
      }
    })
  }

  private eventScope(event: AgentRunEvent): string {
    return 'agentPath' in event.data && event.data.agentPath ? event.data.agentPath : '/root'
  }

  private fragmentKey(event: FragmentEvent): string {
    const scope = this.eventScope(event)
    if (event.type === 'thinking_delta') {
      return `${scope}:thinking:${event.data.id ?? event.data.thinkingId}`
    }

    return `${scope}:content:${event.data.id ?? event.data.contentId}:${event.data.phase ?? ''}`
  }

  private appendPersisted(item: AgentConversationRunEventDTO): void {
    void item
  }

  private appendBlocks(blocks: LiveEventEntry[]): void {
    const entries = blocks
      .flatMap(block => block.completion ? [block, block.completion] : [block])
      .sort((a, b) => a.item.sequence - b.item.sequence)

    for (const entry of entries) {
      if (entry.persistence === 'persisted' || entry.persistence === 'discarded') {
        continue
      }
      this.appendPersisted(entry.item)
      entry.persistence = 'persisted'
    }
  }

  private removeActiveBlock(entry: LiveEventEntry): void {
    if (entry.key && this.activeBlocks.get(entry.key) === entry) {
      this.activeBlocks.delete(entry.key)
    }
  }

  private takePending(predicate: (entry: LiveEventEntry) => boolean): LiveEventEntry[] {
    const blocks: LiveEventEntry[] = []
    for (const entry of this.pendingBlocks) {
      if (entry.persistence !== 'pending' || !predicate(entry)) {
        continue
      }
      this.removeActiveBlock(entry)
      this.pendingBlocks.delete(entry)
      blocks.push(entry)
    }
    return blocks
  }

  private takeRetryBlocks(scope?: string, discard = false): LiveEventEntry[] {
    let blocks: LiveEventEntry[]
    if (scope !== undefined) {
      blocks = this.retryBlocksByScope.get(scope) ?? []
      this.retryBlocksByScope.delete(scope)
    }
    else {
      blocks = [...this.retryBlocksByScope.values()].flat()
      this.retryBlocksByScope.clear()
    }

    if (discard) {
      for (const block of blocks) {
        this.discardBlock(block)
      }
    }
    return blocks
  }

  private flushScope(scope: string): void {
    this.appendBlocks(this.takePending(entry => entry.scope === scope))
  }

  private flushAll(includeRetryBlocks = false): void {
    const blocks = this.takePending(() => true)
    if (includeRetryBlocks) {
      blocks.push(...this.takeRetryBlocks())
    }
    this.appendBlocks(blocks)
  }

  private discardBlock(block: LiveEventEntry): void {
    this.removeActiveBlock(block)
    this.pendingBlocks.delete(block)
    block.persistence = 'discarded'
    if (block.completion) {
      block.completion.persistence = 'discarded'
    }
  }

  private discardScope(scope: string): void {
    for (const block of this.takePending(entry => entry.scope === scope)) {
      this.discardBlock(block)
    }
    this.takeRetryBlocks(scope, true)
    this.retriedScopes.delete(scope)
  }

  private discardAll(): void {
    for (const block of this.pendingBlocks) {
      this.discardBlock(block)
    }
    this.takeRetryBlocks(undefined, true)
    this.activeBlocks.clear()
    this.retriedScopes.clear()
  }

  private moveScopeToRetry(scope: string): void {
    const blocks = this.takePending(entry => entry.scope === scope)
    if (blocks.length === 0) {
      return
    }

    for (const block of blocks) {
      block.persistence = 'retry'
    }
    const existing = this.retryBlocksByScope.get(scope) ?? []
    existing.push(...blocks)
    this.retryBlocksByScope.set(scope, existing)
  }

  private bufferFragment(item: AgentConversationRunEventDTO, event: FragmentEvent): void {
    const scope = this.eventScope(event)
    this.takeRetryBlocks(scope, true)
    const oppositeType = event.type === 'thinking_delta' ? 'content_delta' : 'thinking_delta'
    this.appendBlocks(this.takePending(entry => entry.scope === scope && entry.type === oppositeType))

    const key = this.fragmentKey(event)
    const current = this.activeBlocks.get(key)
    if (current) {
      const data = current.item.event.data as { text: string }
      current.span++
      data.text += event.data.text
      return
    }

    const entry: LiveEventEntry = {
      item: {
        ...item,
        event: {
          ...event,
          data: { ...event.data },
        } as FragmentEvent,
      },
      key,
      persistence: 'pending',
      scope,
      span: 1,
      type: event.type,
    }
    this.liveEvents.push(entry)
    this.activeBlocks.set(key, entry)
    this.pendingBlocks.add(entry)
  }

  private deferThinkingCompletion(entry: LiveEventEntry): boolean {
    if (entry.item.event.type !== 'thinking_completed') {
      return false
    }

    const scope = this.eventScope(entry.item.event)
    const key = `${scope}:thinking:${entry.item.event.data.id ?? entry.item.event.data.thinkingId}`
    const pending = this.activeBlocks.get(key)
    if (pending) {
      this.removeActiveBlock(pending)
      entry.persistence = 'deferred'
      pending.completion = entry
      return true
    }

    const retryBlock = this.retryBlocksByScope.get(scope)?.find(block => block.key === key)
    if (retryBlock) {
      entry.persistence = 'deferred'
      retryBlock.completion = entry
      return true
    }
    return false
  }

  private persist(entry: LiveEventEntry): void {
    const { event } = entry.item
    if (event.type === 'run_retrying') {
      this.retriedScopes.add(this.eventScope(event))
      this.moveScopeToRetry(this.eventScope(event))
      this.appendBlocks([entry])
      return
    }

    if (this.deferThinkingCompletion(entry)) {
      return
    }

    if (event.type === 'run_completed') {
      this.takeRetryBlocks(undefined, true)
      this.flushAll()
      this.retriedScopes.clear()
      this.appendBlocks([entry])
      return
    }

    if (event.type === 'run_failed') {
      if (event.data.code === 'network_interrupted') {
        this.discardAll()
      }
      else {
        this.flushAll(true)
      }
      this.retriedScopes.clear()
      this.appendBlocks([entry])
      return
    }

    if (event.type === 'run_cancelled') {
      if (event.data.reason === 'user') {
        this.flushAll(true)
      }
      else {
        this.discardAll()
      }
      this.retriedScopes.clear()
      this.appendBlocks([entry])
      return
    }

    const scope = this.eventScope(event)
    if (
      event.type === 'worker_completed'
      && event.data.status !== 'success'
      && event.data.status !== 'cancelled'
      && this.retriedScopes.has(scope)
    ) {
      this.discardScope(scope)
    }
    else {
      this.takeRetryBlocks(scope, true)
      this.flushScope(scope)
      this.retriedScopes.delete(scope)
    }
    this.appendBlocks([entry])
  }

  private clearLiveEvents(): void {
    this.liveEvents.length = 0
    this.activeBlocks.clear()
    this.pendingBlocks.clear()
    this.retryBlocksByScope.clear()
    this.retriedScopes.clear()
  }

  publish(event: AgentRunEvent, timestamp = Date.now()): AgentConversationRunEventDTO | null {
    if (this.terminal) {
      return null
    }

    const scopedEvent = 'agentPath' in event.data && event.data.agentPath
      ? event
      : withAgentPath(event, '/root')
    const item: AgentConversationRunEventDTO = {
      ...this.identity,
      sequence: ++this.sequence,
      timestamp,
      event: scopedEvent,
    }

    if (scopedEvent.type === 'thinking_delta' || scopedEvent.type === 'content_delta') {
      this.bufferFragment(item, scopedEvent)
    }
    else {
      const entry: LiveEventEntry = {
        item,
        persistence: 'pending',
        scope: this.eventScope(scopedEvent),
        span: 1,
      }
      this.liveEvents.push(entry)
      this.persist(entry)
    }

    if (scopedEvent.type === 'approval_requested') {
      this.approvalId = scopedEvent.data.approvalId
    }
    else if (scopedEvent.type === 'approval_resolved') {
      this.approvalId = undefined
    }

    if (TERMINAL_TYPES.has(scopedEvent.type)) {
      this.terminal = true
      this.terminalStatusValue = scopedEvent.type === 'run_completed'
        ? 'completed'
        : event.type === 'run_failed' ? 'failed' : 'cancelled'
    }

    this.hub.emit(item)
    if (this.terminal) {
      this.hub.finish(this)
      this.clearLiveEvents()
    }
    return item
  }
}

export class RunEventHub {
  private readonly activeByConversation = new Map<string, RunEventPublisher>()
  private readonly listeners = new Set<RunEventListener>()

  tryBegin(input: BeginRunInput): RunEventPublisher | null {
    if (this.activeByConversation.has(input.conversationId)) {
      return null
    }

    const identity: RunIdentity = {
      conversationId: input.conversationId,
      runId: input.runId,
      turnId: input.turnId,
      assistantMessageId: input.assistantMessageId,
    }
    const publisher = new RunEventPublisher(identity, this)
    this.activeByConversation.set(input.conversationId, publisher)
    publisher.publish({
      type: 'run_started',
      data: {
        requestId: input.requestId,
        source: input.source,
        assistantMessageId: input.assistantMessageId,
        startedAt: input.startedAt ?? Date.now(),
      },
    })
    return publisher
  }

  isActive(conversationId: string): boolean {
    return this.activeByConversation.has(conversationId)
  }

  /** 当前活跃的会话 run 数（资源监控用） */
  get activeRunCount(): number {
    return this.activeByConversation.size
  }

  getActive(conversationId: string): RunEventPublisher | undefined {
    return this.activeByConversation.get(conversationId)
  }

  getActiveEvents(): AgentConversationRunEventDTO[] {
    return [...this.activeByConversation.values()]
      .flatMap(publisher => publisher.getLiveEvents())
  }

  subscribe(listener: RunEventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(event: AgentConversationRunEventDTO): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  finish(publisher: RunEventPublisher): void {
    if (this.activeByConversation.get(publisher.identity.conversationId) === publisher) {
      this.activeByConversation.delete(publisher.identity.conversationId)
    }
  }
}

export const runEventHub = new RunEventHub()
