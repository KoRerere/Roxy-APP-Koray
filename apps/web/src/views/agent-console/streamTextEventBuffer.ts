import type { AgentConversationRunEventDTO } from '@roxy/shared/channel'

export interface StreamTextEventBufferScheduler {
  schedule: (callback: () => void, delayMs: number) => () => void
}

export interface StreamTextEventBufferSchedulerHost {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
  cancelIdleCallback?: (handle: number) => void
  setTimeout: typeof setTimeout
  clearTimeout: typeof clearTimeout
}

interface StreamTextEventBufferOptions {
  onError: (error: unknown) => void
  onFlush: (items: AgentConversationRunEventDTO[]) => Promise<void> | void
  scheduler: StreamTextEventBufferScheduler
  ttlMs: number
}

interface StreamTextEventBufferEntry {
  cancelTimer: () => void
  conversationId: string
  items: AgentConversationRunEventDTO[]
  runId: string
}

function eventAgentPath(item: AgentConversationRunEventDTO): string {
  const { data } = item.event
  const agentPath = 'agentPath' in data && typeof data.agentPath === 'string'
    ? data.agentPath
    : undefined
  const workerId = 'workerId' in data && typeof data.workerId === 'string'
    ? data.workerId
    : undefined
  return agentPath || workerId || '/root'
}

function bufferKey(item: AgentConversationRunEventDTO): string {
  return JSON.stringify([item.conversationId, eventAgentPath(item)])
}

export function isStreamTextEvent(item: AgentConversationRunEventDTO): boolean {
  return item.event.type === 'content_delta' || item.event.type === 'thinking_delta'
}

export function createIdleAwareStreamTextEventBufferScheduler(
  host: StreamTextEventBufferSchedulerHost,
): StreamTextEventBufferScheduler {
  return {
    schedule(callback, delayMs) {
      if (host.requestIdleCallback && host.cancelIdleCallback) {
        const idleHandle = host.requestIdleCallback(callback, { timeout: delayMs })
        return () => host.cancelIdleCallback?.(idleHandle)
      }

      const timerId = host.setTimeout(callback, delayMs)
      return () => host.clearTimeout(timerId)
    },
  }
}

export class StreamTextEventBuffer {
  private readonly entries = new Map<string, StreamTextEventBufferEntry>()
  private readonly inFlightByRunId = new Map<string, Set<Promise<void>>>()

  constructor(private readonly options: StreamTextEventBufferOptions) {}

  enqueue(item: AgentConversationRunEventDTO): boolean {
    if (!isStreamTextEvent(item)) {
      return false
    }

    const key = bufferKey(item)
    const existing = this.entries.get(key)
    if (existing?.runId === item.runId) {
      existing.items.push(item)
      return true
    }
    if (existing) {
      void this.flushEntry(key, existing).catch(this.options.onError)
    }

    const entry: StreamTextEventBufferEntry = {
      cancelTimer: () => {},
      conversationId: item.conversationId,
      items: [item],
      runId: item.runId,
    }
    entry.cancelTimer = this.options.scheduler.schedule(() => {
      void this.flushEntry(key, entry).catch(this.options.onError)
    }, this.options.ttlMs)
    this.entries.set(key, entry)
    return true
  }

  async flushRun(runId: string): Promise<void> {
    const pendingFlushes: Promise<void>[] = []
    for (const [key, entry] of this.entries) {
      if (entry.runId === runId) {
        pendingFlushes.push(this.flushEntry(key, entry))
      }
    }

    const inFlight = this.inFlightByRunId.get(runId)
    if (inFlight) {
      pendingFlushes.push(...inFlight)
    }
    await Promise.all(pendingFlushes)
  }

  discardRun(runId: string): void {
    for (const [key, entry] of this.entries) {
      if (entry.runId === runId) {
        entry.cancelTimer()
        this.entries.delete(key)
      }
    }
  }

  removeConversation(conversationId: string): void {
    for (const [key, entry] of this.entries) {
      if (entry.conversationId === conversationId) {
        entry.cancelTimer()
        this.entries.delete(key)
      }
    }
  }

  private flushEntry(key: string, entry: StreamTextEventBufferEntry): Promise<void> {
    if (this.entries.get(key) !== entry) {
      return Promise.resolve()
    }

    entry.cancelTimer()
    this.entries.delete(key)
    const items = [...entry.items].sort((left, right) => left.sequence - right.sequence)

    let flushResult: Promise<void> | void
    try {
      flushResult = this.options.onFlush(items)
    }
    catch (error) {
      flushResult = Promise.reject(error)
    }

    const flushPromise = Promise.resolve(flushResult)
    const inFlight = this.inFlightByRunId.get(entry.runId) ?? new Set<Promise<void>>()
    inFlight.add(flushPromise)
    this.inFlightByRunId.set(entry.runId, inFlight)
    void flushPromise.finally(() => {
      inFlight.delete(flushPromise)
      if (inFlight.size === 0) {
        this.inFlightByRunId.delete(entry.runId)
      }
    }).catch(() => {})
    return flushPromise
  }
}
