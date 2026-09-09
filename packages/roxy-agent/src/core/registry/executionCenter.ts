export type ExecutionSource = 'conversation' | 'scheduled_task' | 'im' | 'worker'

export type ExecutionStatus
  = | 'queued'
    | 'running'
    | 'waiting'
    | 'paused'
    | 'cancelling'
    | 'completed'
    | 'failed'
    | 'cancelled'

export interface ManagedExecution {
  id: string
  source: ExecutionSource
  status: ExecutionStatus
  conversationId?: string
  parentId?: string
  title?: string
  createdAt: number
  startedAt?: number
  endedAt?: number
  updatedAt: number
  metadata?: Record<string, unknown>
  cancelReason?: string
}

export interface RegisterExecutionInput {
  id: string
  source: ExecutionSource
  conversationId?: string
  parentId?: string
  title?: string
  metadata?: Record<string, unknown>
  cancel?: () => boolean | void | Promise<boolean | void>
  now?: number
}

export interface ExecutionCenterSnapshot {
  type: 'snapshot'
  generatedAt: number
  entries: ManagedExecution[]
}

const TERMINAL_STATUSES = new Set<ExecutionStatus>(['completed', 'failed', 'cancelled'])

function clone(entry: ManagedExecution): ManagedExecution {
  return {
    ...entry,
    ...(entry.metadata ? { metadata: { ...entry.metadata } } : {}),
  }
}

/**
 * Process-wide execution control plane.
 *
 * Executors keep ownership of their actual resources (AbortController,
 * runtime Agent, task runner, or IM stream). The center only owns lifecycle
 * state and delegates cancellation to the registered owner callback. This
 * keeps the control plane independent from any one agent implementation.
 */
export class ExecutionCenter {
  private readonly entries = new Map<string, ManagedExecution>()
  private readonly cancelHandlers = new Map<string, () => boolean | void | Promise<boolean | void>>()
  private readonly pausedFrom = new Map<string, 'queued' | 'waiting'>()
  private readonly subscribers = new Set<(snapshot: ExecutionCenterSnapshot) => void>()

  register(input: RegisterExecutionInput): ManagedExecution {
    const now = input.now ?? Date.now()
    const existing = this.entries.get(input.id)
    if (existing) {
      if (input.cancel) {
        this.cancelHandlers.set(input.id, input.cancel)
      }
      if (input.title !== undefined) {
        existing.title = input.title
      }
      if (input.conversationId !== undefined) {
        existing.conversationId = input.conversationId
      }
      if (input.metadata) {
        existing.metadata = { ...existing.metadata, ...input.metadata }
      }
      existing.updatedAt = now
      this.broadcast()
      return clone(existing)
    }

    const entry: ManagedExecution = {
      id: input.id,
      source: input.source,
      status: 'queued',
      conversationId: input.conversationId,
      parentId: input.parentId,
      title: input.title,
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata ? { ...input.metadata } : undefined,
    }
    this.entries.set(input.id, entry)
    if (input.cancel) {
      this.cancelHandlers.set(input.id, input.cancel)
    }
    this.broadcast()
    return clone(entry)
  }

  bindCancel(id: string, cancel: () => boolean | void | Promise<boolean | void>): boolean {
    if (!this.entries.has(id) || this.isTerminal(id)) {
      return false
    }
    this.cancelHandlers.set(id, cancel)
    return true
  }

  start(id: string, now = Date.now()): boolean {
    const entry = this.entries.get(id)
    if (!entry || TERMINAL_STATUSES.has(entry.status) || entry.status === 'cancelling') {
      return false
    }
    entry.status = 'running'
    entry.startedAt ??= now
    entry.updatedAt = now
    this.broadcast()
    return true
  }

  setStatus(id: string, status: Exclude<ExecutionStatus, 'completed' | 'failed' | 'cancelled'>, now = Date.now()): boolean {
    const entry = this.entries.get(id)
    if (!entry || TERMINAL_STATUSES.has(entry.status) || entry.status === 'cancelling') {
      return false
    }
    entry.status = status
    if (status === 'running') {
      entry.startedAt ??= now
    }
    entry.updatedAt = now
    this.broadcast()
    return true
  }

  finish(id: string, status: Extract<ExecutionStatus, 'completed' | 'failed' | 'cancelled'>, metadata?: Record<string, unknown>, now = Date.now()): boolean {
    const entry = this.entries.get(id)
    if (!entry || TERMINAL_STATUSES.has(entry.status)) {
      return false
    }
    entry.status = status
    entry.endedAt = now
    entry.updatedAt = now
    if (metadata) {
      entry.metadata = { ...entry.metadata, ...metadata }
    }
    this.cancelHandlers.delete(id)
    this.pausedFrom.delete(id)
    this.broadcast()
    return true
  }

  async cancel(id: string, reason = 'user'): Promise<boolean> {
    const entry = this.entries.get(id)
    if (!entry || TERMINAL_STATUSES.has(entry.status) || entry.status === 'cancelling') {
      return false
    }

    const handler = this.cancelHandlers.get(id)
    const previousStatus = entry.status
    entry.status = 'cancelling'
    entry.cancelReason = reason
    entry.updatedAt = Date.now()
    this.broadcast()
    let accepted = false
    try {
      accepted = handler ? Boolean(await handler()) : false
    }
    catch (error) {
      console.warn(`[execution-center] Failed to cancel ${id}:`, error)
    }
    if (accepted === false && this.entries.get(id)?.status === 'cancelling') {
      entry.status = previousStatus
      entry.updatedAt = Date.now()
      this.broadcast()
      return false
    }
    return true
  }

  async cancelByConversation(conversationId: string, reason = 'user'): Promise<number> {
    const ids = [...this.entries.values()]
      .filter(entry => entry.conversationId === conversationId && !TERMINAL_STATUSES.has(entry.status))
      .map(entry => entry.id)
    const results = await Promise.all(ids.map(id => this.cancel(id, reason)))
    return results.filter(Boolean).length
  }

  pause(id: string): boolean {
    const entry = this.entries.get(id)
    if (!entry || TERMINAL_STATUSES.has(entry.status) || entry.status === 'cancelling' || (entry.status !== 'queued' && entry.status !== 'waiting')) {
      return false
    }
    this.pausedFrom.set(id, entry.status)
    entry.status = 'paused'
    entry.updatedAt = Date.now()
    this.broadcast()
    return true
  }

  resume(id: string): boolean {
    const entry = this.entries.get(id)
    if (!entry || entry.status !== 'paused') {
      return false
    }
    entry.status = this.pausedFrom.get(id) ?? 'queued'
    this.pausedFrom.delete(id)
    entry.updatedAt = Date.now()
    this.broadcast()
    return true
  }

  get(id: string): ManagedExecution | undefined {
    const entry = this.entries.get(id)
    return entry ? clone(entry) : undefined
  }

  list(): ManagedExecution[] {
    return [...this.entries.values()]
      .map(clone)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  snapshot(): ExecutionCenterSnapshot {
    return {
      type: 'snapshot',
      generatedAt: Date.now(),
      entries: this.list(),
    }
  }

  getSnapshot(): ExecutionCenterSnapshot {
    return this.snapshot()
  }

  subscribe(listener: (snapshot: ExecutionCenterSnapshot) => void): () => void {
    this.subscribers.add(listener)
    listener(this.snapshot())
    return () => this.subscribers.delete(listener)
  }

  async cancelAll(reason = 'client_shutdown'): Promise<void> {
    const ids = [...this.entries.values()]
      .filter(entry => !TERMINAL_STATUSES.has(entry.status))
      .map(entry => entry.id)
    await Promise.all(ids.map(id => this.cancel(id, reason)))
  }

  clearFinished(): void {
    for (const [id, entry] of this.entries) {
      if (TERMINAL_STATUSES.has(entry.status)) {
        this.entries.delete(id)
      }
    }
    this.broadcast()
  }

  clear(): void {
    this.entries.clear()
    this.cancelHandlers.clear()
    this.pausedFrom.clear()
    this.broadcast()
  }

  isTerminal(id: string): boolean {
    const status = this.entries.get(id)?.status
    return status ? TERMINAL_STATUSES.has(status) : false
  }

  private broadcast(): void {
    const snapshot = this.snapshot()
    for (const listener of this.subscribers) {
      try {
        listener(snapshot)
      }
      catch {
        // A stale subscriber must not break execution control.
      }
    }
  }
}

export const executionCenter = new ExecutionCenter()
