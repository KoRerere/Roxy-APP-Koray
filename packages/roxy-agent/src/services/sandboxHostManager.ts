import type { SandboxAgentCommand, SandboxHostRunResult, SandboxHostToAgentMessage, SandboxRunPayload, SandboxRunPhase } from '@/core/sandbox/host-protocol'
import type { LlmTransport } from '@/modes/sandbox-api/llm'
import type { ChildProcess } from 'node:child_process'
import { fork } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { env } from '@/config'
import { parseSandboxHostToAgentMessage, SANDBOX_HOST_PROTOCOL_VERSION } from '@/core/sandbox/host-protocol'
import { buildLlmTransport } from '@/modes/sandbox-api/hostLlm'

function numberEnv(name: string, fallback: number, min = 1): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value >= min ? Math.floor(value) : fallback
}

const HOST_START_TIMEOUT_MS = numberEnv('SANDBOX_HOST_START_TIMEOUT_MS', 15_000)
const HEARTBEAT_TIMEOUT_MS = numberEnv('SANDBOX_HOST_HEARTBEAT_TIMEOUT_MS', 60_000)
const ABORT_GRACE_MS = numberEnv('SANDBOX_HOST_ABORT_GRACE_MS', 5_000)
const IDLE_TIMEOUT_MS = numberEnv('SANDBOX_HOST_IDLE_TIMEOUT_MS', 60_000)
const MAX_RUNS = numberEnv('SANDBOX_HOST_MAX_RUNS', 100)
const MAX_RSS_BYTES = numberEnv('SANDBOX_HOST_MAX_RSS_MB', 512) * 1024 * 1024
const DEFAULT_CONCURRENCY = numberEnv('SANDBOX_HOST_MAX_CONCURRENCY', 10)

type LlmTransportFactory = (runId: string) => LlmTransport

export interface SandboxHostRunHandlers {
  onLog?: (event: { level: string, message: string, runId: string }) => void
  onPhase?: (event: { phase: SandboxRunPhase, timestamp: number, runId: string }) => void
}

export interface SandboxHostRunHandle {
  finished: Promise<SandboxHostRunResult>
  stop: (reason?: 'user' | 'task' | 'timeout' | 'shutdown') => void
}

export interface SandboxHostReservation {
  start: (runId: string, payload: SandboxRunPayload, handlers?: SandboxHostRunHandlers) => Promise<SandboxHostRunHandle>
  release: () => void
}

interface QueueEntry {
  resolve: (reservation: SandboxHostReservation) => void
  reject: (error: Error) => void
  signal?: AbortSignal
  onAbort?: () => void
}

interface HostState {
  generation: string
  child: ChildProcess
  ready: boolean
  draining: boolean
  startedAt: number
  lastSeen: number
  completedRuns: number
  recycleReason?: 'max-runs' | 'rss'
  lastHeartbeat?: { timestamp: number, activeRuns: number, eventLoopDelayMs?: number, rss: number, heapUsed: number, external: number }
  lastHeartbeatDebugAt?: number
  finalized: boolean
  resolveReady: () => void
  rejectReady: (error: Error) => void
  readyPromise: Promise<void>
  startTimer: NodeJS.Timeout
}

interface PendingRun {
  runId: string
  generation: string
  started: boolean
  resolveStarted: () => void
  rejectStarted: (error: Error) => void
  resolveFinished: (result: SandboxHostRunResult) => void
  finished: Promise<SandboxHostRunResult>
  handlers: SandboxHostRunHandlers
  release: () => void
  signal?: AbortSignal
  onAbort?: () => void
  abortTimer?: NodeJS.Timeout
  llmAbortController: AbortController
  llmTransport: LlmTransport
  lastPhase?: { phase: SandboxRunPhase, timestamp: number }
  lastLog?: string
  reservedAt: number
  startedAt?: number
}

function abortError(): Error {
  const error = new Error('Sandbox run aborted before execution')
  error.name = 'AbortError'
  return error
}

function childEnv(generation: string): NodeJS.ProcessEnv {
  const keys = [
    'PATH',
    'HOME',
    'USERPROFILE',
    'TMPDIR',
    'TMP',
    'TEMP',
    'SystemRoot',
    'ComSpec',
    'PATHEXT',
    'LANG',
    'LC_ALL',
  ]
  const result: NodeJS.ProcessEnv = {
    ROXY_MODE: 'sandbox',
    SANDBOX_HOST_GENERATION: generation,
    ENV_TYPE: env.ENV_TYPE,
  }
  for (const key of keys) {
    if (process.env[key] !== undefined) {
      result[key] = process.env[key]
    }
  }
  return result
}

export class SandboxHostManager {
  private host: HostState | undefined
  private startup: Promise<HostState> | undefined
  private readonly pendingRuns = new Map<string, PendingRun>()
  private readonly queue: QueueEntry[] = []
  private readonly maxConcurrency: number
  private activeSlots = 0
  private idleTimer: NodeJS.Timeout | undefined
  private shuttingDown = false
  private readonly watchdog: NodeJS.Timeout

  constructor(
    maxConcurrency = DEFAULT_CONCURRENCY,
    private readonly createLlmTransport: LlmTransportFactory = buildLlmTransport,
  ) {
    this.maxConcurrency = Math.max(1, maxConcurrency)
    this.watchdog = setInterval(() => this.checkHealth(), 1_000)
    this.watchdog.unref()
  }

  reserve(signal?: AbortSignal): Promise<SandboxHostReservation> {
    if (this.shuttingDown) {
      return Promise.reject(new Error('Sandbox Host manager is shutting down'))
    }
    if (signal?.aborted) {
      return Promise.reject(abortError())
    }
    if (this.activeSlots < this.maxConcurrency) {
      this.acquireSlot()
      console.debug(`[sandboxHostManager] reservation granted activeSlots=${this.activeSlots}/${this.maxConcurrency}`)
      return Promise.resolve(this.createReservation(signal))
    }

    return new Promise((resolve, reject) => {
      const entry: QueueEntry = { resolve, reject, signal }
      if (signal) {
        entry.onAbort = () => {
          const index = this.queue.indexOf(entry)
          if (index >= 0) {
            this.queue.splice(index, 1)
          }
          reject(abortError())
        }
        signal.addEventListener('abort', entry.onAbort, { once: true })
      }
      this.queue.push(entry)
      console.debug(`[sandboxHostManager] reservation queued activeSlots=${this.activeSlots}/${this.maxConcurrency} queueLength=${this.queue.length}`)
    })
  }

  async shutdown(): Promise<void> {
    if (this.shuttingDown) {
      return
    }
    this.shuttingDown = true
    clearInterval(this.watchdog)
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
    }
    for (const entry of this.queue.splice(0)) {
      if (entry.signal && entry.onAbort) {
        entry.signal.removeEventListener('abort', entry.onAbort)
      }
      entry.reject(new Error('Sandbox Host manager shut down'))
    }
    for (const pending of this.pendingRuns.values()) {
      this.abortPending(pending, 'shutdown')
    }

    const host = this.host
    if (!host || host.finalized) {
      return
    }
    try {
      this.send(host, { type: 'host.shutdown', reason: 'agent-shutdown' })
    }
    catch (error) {
      this.finalizeHost(host, error instanceof Error ? error : new Error(String(error)))
      return
    }
    await Promise.race([
      new Promise<void>(resolve => host.child.once('exit', () => resolve())),
      new Promise<void>(resolve => setTimeout(resolve, ABORT_GRACE_MS)),
    ])
    if (!host.finalized) {
      host.child.kill('SIGKILL')
    }
  }

  private createReservation(signal?: AbortSignal): SandboxHostReservation {
    let released = false
    let transferred = false
    const release = (): void => {
      if (released) {
        return
      }
      released = true
      this.activeSlots = Math.max(0, this.activeSlots - 1)
      this.drainQueue()
      this.scheduleIdleRecycle()
    }

    return {
      release: () => {
        if (!transferred) {
          release()
        }
      },
      start: async (runId, payload, handlers = {}) => {
        if (released || transferred) {
          throw new Error('Sandbox Host reservation is no longer available')
        }
        transferred = true
        try {
          return await this.startReservedRun(runId, payload, handlers, release, signal)
        }
        catch (error) {
          release()
          throw error
        }
      },
    }
  }

  private drainQueue(): void {
    while (!this.shuttingDown && this.activeSlots < this.maxConcurrency && this.queue.length > 0) {
      const entry = this.queue.shift()!
      if (entry.signal && entry.onAbort) {
        entry.signal.removeEventListener('abort', entry.onAbort)
      }
      if (entry.signal?.aborted) {
        entry.reject(abortError())
        continue
      }
      this.acquireSlot()
      console.debug(`[sandboxHostManager] reservation dequeued activeSlots=${this.activeSlots}/${this.maxConcurrency} queueLength=${this.queue.length}`)
      entry.resolve(this.createReservation(entry.signal))
    }
  }

  private acquireSlot(): void {
    this.activeSlots++
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = undefined
    }
  }

  private async startReservedRun(
    runId: string,
    payload: SandboxRunPayload,
    handlers: SandboxHostRunHandlers,
    release: () => void,
    signal?: AbortSignal,
  ): Promise<SandboxHostRunHandle> {
    if (signal?.aborted) {
      throw abortError()
    }
    const reservedAt = Date.now()
    console.debug(`[sandboxHostManager] run=${runId} waiting for Host`)
    const host = await this.ensureHost()
    console.debug(`[sandboxHostManager] run=${runId} Host ready waitMs=${Date.now() - reservedAt} generation=${host.generation}`)
    if (signal?.aborted) {
      throw abortError()
    }
    if (this.pendingRuns.has(runId)) {
      throw new Error(`Duplicate sandbox runId: ${runId}`)
    }

    let resolveStarted!: () => void
    let rejectStarted!: (error: Error) => void
    const started = new Promise<void>((resolve, reject) => {
      resolveStarted = resolve
      rejectStarted = reject
    })
    let resolveFinished!: (result: SandboxHostRunResult) => void
    const finished = new Promise<SandboxHostRunResult>((resolve) => {
      resolveFinished = resolve
    })
    const pending: PendingRun = {
      runId,
      generation: host.generation,
      started: false,
      resolveStarted,
      rejectStarted,
      resolveFinished,
      finished,
      handlers,
      release,
      signal,
      llmAbortController: new AbortController(),
      llmTransport: this.createLlmTransport(runId),
      reservedAt,
    }
    this.pendingRuns.set(runId, pending)
    if (signal) {
      pending.onAbort = () => this.abortPending(pending, 'user')
      if (signal.aborted) {
        pending.onAbort()
      }
      else {
        signal.addEventListener('abort', pending.onAbort, { once: true })
      }
    }
    try {
      this.send(host, { type: 'run.start', runId, payload })
      console.debug(`[sandboxHostManager] run=${runId} run.start sent generation=${host.generation}`)
    }
    catch (error) {
      this.finalizeHost(host, error instanceof Error ? error : new Error(String(error)))
    }
    await started
    return {
      finished,
      stop: reason => this.abortPending(pending, reason ?? 'user'),
    }
  }

  private async ensureHost(): Promise<HostState> {
    if (this.host && !this.host.finalized && this.host.ready && !this.host.draining) {
      return this.host
    }
    if (this.startup) {
      return this.startup
    }
    this.startup = this.spawnHost().finally(() => {
      this.startup = undefined
    })
    return this.startup
  }

  private async spawnHost(): Promise<HostState> {
    const modulePath = env.AGENT_SCRIPT_PATH
    if (!modulePath) {
      throw new Error('AGENT_SCRIPT_PATH is not configured')
    }
    const generation = randomUUID()
    const child = fork(modulePath, [], {
      env: childEnv(generation),
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      execArgv: ['--experimental-strip-types', '--experimental-vm-modules'],
      execPath: process.execPath,
    })

    let resolveReady!: () => void
    let rejectReady!: (error: Error) => void
    const readyPromise = new Promise<void>((resolve, reject) => {
      resolveReady = resolve
      rejectReady = reject
    })
    const host = {} as HostState
    Object.assign(host, {
      generation,
      child,
      ready: false,
      draining: false,
      startedAt: Date.now(),
      lastSeen: Date.now(),
      completedRuns: 0,
      finalized: false,
      resolveReady,
      rejectReady,
      readyPromise,
      startTimer: setTimeout(() => {
        rejectReady(new Error(`Sandbox Host did not become ready within ${HOST_START_TIMEOUT_MS}ms`))
        child.kill('SIGKILL')
      }, HOST_START_TIMEOUT_MS),
    } satisfies HostState)
    this.host = host

    child.on('message', raw => this.onHostMessage(host, raw))
    child.on('error', error => this.finalizeHost(host, error))
    child.on('disconnect', () => this.finalizeHost(host, new Error('Sandbox Host IPC disconnected')))
    child.on('exit', (code, signal) => this.finalizeHost(host, new Error(`Sandbox Host exited code=${code} signal=${signal}`)))
    child.stdout?.on('data', chunk => console.warn(`[sandbox-host stdout] ${String(chunk).trimEnd()}`))
    child.stderr?.on('data', chunk => console.error(`[sandbox-host stderr] ${String(chunk).trimEnd()}`))

    try {
      await readyPromise
      return host
    }
    catch (error) {
      this.finalizeHost(host, error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  private onHostMessage(host: HostState, raw: unknown): void {
    if (host.finalized || this.host !== host) {
      return
    }
    let message: SandboxHostToAgentMessage
    try {
      message = parseSandboxHostToAgentMessage(raw)
    }
    catch (error) {
      console.error('[sandboxHostManager] Invalid host message:', error)
      return
    }
    if (message.generation !== host.generation) {
      return
    }
    host.lastSeen = Date.now()

    switch (message.type) {
      case 'host.ready':
        host.ready = true
        clearTimeout(host.startTimer)
        host.resolveReady()
        break
      case 'host.heartbeat':
        host.lastHeartbeat = {
          timestamp: message.timestamp,
          activeRuns: message.activeRuns,
          eventLoopDelayMs: message.eventLoopDelayMs,
          rss: message.memory.rss,
          heapUsed: message.memory.heapUsed,
          external: message.memory.external,
        }
        if (message.memory.rss >= MAX_RSS_BYTES) {
          host.recycleReason = 'rss'
        }
        if (message.activeRuns > 0 && (
          host.lastHeartbeatDebugAt === undefined
          || message.timestamp - host.lastHeartbeatDebugAt >= 5_000
          || (message.eventLoopDelayMs ?? 0) >= 1_000
        )) {
          host.lastHeartbeatDebugAt = message.timestamp
          console.debug(`[sandboxHostManager] heartbeat generation=${host.generation} activeRuns=${message.activeRuns} activeSlots=${this.activeSlots}/${this.maxConcurrency} queueLength=${this.queue.length} eventLoopDelayMs=${message.eventLoopDelayMs ?? 'unknown'} rssMb=${(message.memory.rss / 1024 / 1024).toFixed(1)} heapUsedMb=${(message.memory.heapUsed / 1024 / 1024).toFixed(1)} externalMb=${(message.memory.external / 1024 / 1024).toFixed(1)}`)
        }
        break
      case 'run.started': {
        const pending = this.pendingRuns.get(message.runId)
        if (!pending || pending.generation !== host.generation) {
          return
        }
        pending.started = true
        pending.startedAt = Date.now()
        pending.resolveStarted()
        console.debug(`[sandboxHostManager] run=${message.runId} started waitMs=${Date.now() - pending.reservedAt} generation=${host.generation}`)
        break
      }
      case 'run.log': {
        const pending = this.pendingRuns.get(message.runId)
        if (pending?.generation === host.generation) {
          pending.lastLog = message.message.slice(-500)
          pending.handlers.onLog?.({ level: message.level, message: message.message, runId: message.runId })
        }
        break
      }
      case 'run.phase': {
        const pending = this.pendingRuns.get(message.runId)
        if (pending?.generation === host.generation) {
          pending.lastPhase = { phase: message.phase, timestamp: message.timestamp }
          console.debug(`[sandboxHostManager] run phase generation=${host.generation} runId=${message.runId} phase=${message.phase} phaseAgeMs=${Math.max(0, Date.now() - message.timestamp)}`)
          pending.handlers.onPhase?.({ phase: message.phase, timestamp: message.timestamp, runId: message.runId })
        }
        break
      }
      case 'run.finished':
        this.finishPending(host, message.runId, message.result)
        break
      case 'rpc.llm.request':
        void this.handleLlmRequest(host, message)
        break
      case 'host.fatal':
        this.finalizeHost(host, new Error(message.message))
        host.child.kill('SIGTERM')
        break
      case 'run.diagnostic':
        console.warn(`[sandboxHostManager] ${message.runId ? `runId=${message.runId} ` : ''}${message.message}`)
        break
    }
  }

  private async handleLlmRequest(
    host: HostState,
    message: Extract<SandboxHostToAgentMessage, { type: 'rpc.llm.request' }>,
  ): Promise<void> {
    const pending = this.pendingRuns.get(message.runId)
    if (!pending || pending.generation !== host.generation) {
      return
    }
    let response: SandboxAgentCommand
    const startedAt = Date.now()
    console.debug(`[sandboxHostManager] run=${message.runId} LLM request=${message.requestId} started`)
    try {
      const value = await pending.llmTransport.ask({
        prompt: message.request.prompt,
        ...(message.request.schema && typeof message.request.schema === 'object'
          ? { schema: message.request.schema as Record<string, unknown> }
          : {}),
        options: { signal: pending.llmAbortController.signal },
      })
      response = { type: 'rpc.llm.response', runId: message.runId, requestId: message.requestId, ok: true, value }
    }
    catch (error) {
      response = {
        type: 'rpc.llm.response',
        runId: message.runId,
        requestId: message.requestId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
    console.debug(`[sandboxHostManager] run=${message.runId} LLM request=${message.requestId} finished durationMs=${Date.now() - startedAt} ok=${response.type === 'rpc.llm.response' && response.ok}`)

    if (this.pendingRuns.get(message.runId) !== pending || this.host !== host || host.finalized) {
      return
    }
    try {
      this.send(host, response)
    }
    catch (error) {
      this.finalizeHost(host, error instanceof Error ? error : new Error(String(error)))
    }
  }

  private finishPending(host: HostState, runId: string, result: SandboxHostRunResult): void {
    const pending = this.pendingRuns.get(runId)
    if (!pending || pending.generation !== host.generation) {
      return
    }
    this.pendingRuns.delete(runId)
    if (pending.abortTimer) {
      clearTimeout(pending.abortTimer)
    }
    pending.llmAbortController.abort('sandbox run finished')
    if (pending.signal && pending.onAbort) {
      pending.signal.removeEventListener('abort', pending.onAbort)
    }
    pending.resolveFinished(result)
    console.debug(`[sandboxHostManager] run=${runId} finished status=${result.status} durationMs=${Date.now() - (pending.startedAt ?? pending.reservedAt)} totalWaitMs=${(pending.startedAt ?? Date.now()) - pending.reservedAt}`)
    pending.release()
    host.completedRuns++
    if (host.completedRuns >= MAX_RUNS) {
      host.recycleReason = 'max-runs'
    }
    this.recycleIfIdle(host)
  }

  private abortPending(pending: PendingRun, reason: 'user' | 'task' | 'timeout' | 'shutdown'): void {
    const host = this.host
    if (!host || host.finalized || pending.generation !== host.generation) {
      return
    }
    pending.llmAbortController.abort(reason)
    try {
      this.send(host, { type: 'run.abort', runId: pending.runId, reason })
    }
    catch (error) {
      this.finalizeHost(host, error instanceof Error ? error : new Error(String(error)))
      return
    }
    if (!pending.abortTimer) {
      pending.abortTimer = setTimeout(() => {
        if (this.pendingRuns.has(pending.runId) && this.host === host && !host.finalized) {
          console.error(`[sandboxHostManager] runId=${pending.runId} exceeded abort grace; recycling Host`)
          host.child.kill('SIGTERM')
          setTimeout(() => host.child.kill('SIGKILL'), 1_000).unref()
        }
      }, ABORT_GRACE_MS)
      pending.abortTimer.unref()
    }
  }

  private send(host: HostState, message: SandboxAgentCommand): void {
    if (host.finalized || !host.child.connected) {
      throw new Error('Sandbox Host IPC is not connected')
    }
    host.child.send({
      ...message,
      protocolVersion: SANDBOX_HOST_PROTOCOL_VERSION,
      generation: host.generation,
    })
  }

  private checkHealth(): void {
    const host = this.host
    if (!host || host.finalized || !host.ready) {
      return
    }
    if (Date.now() - host.lastSeen <= HEARTBEAT_TIMEOUT_MS) {
      return
    }
    const heartbeat = host.lastHeartbeat
    const runDiagnostics = Array.from(this.pendingRuns.values())
      .filter(pending => pending.generation === host.generation)
      .map((pending) => {
        const phase = pending.lastPhase
        const phaseAge = phase ? Math.max(0, Date.now() - phase.timestamp) : undefined
        return `runId=${pending.runId} started=${pending.started} phase=${phase?.phase ?? 'unknown'} phaseAgeMs=${phaseAge ?? 'unknown'} lastLog=${JSON.stringify(pending.lastLog ?? '')}`
      })
      .join(' | ')
    console.error(`[sandboxHostManager] heartbeat timed out generation=${host.generation} lastSeenAgeMs=${Date.now() - host.lastSeen} activeRuns=${this.pendingRuns.size} heartbeat=${heartbeat ? JSON.stringify(heartbeat) : 'none'} ${runDiagnostics}`)
    host.child.kill('SIGTERM')
    setTimeout(() => host.child.kill('SIGKILL'), 1_000).unref()
    this.finalizeHost(host, new Error('Sandbox Host heartbeat timed out'))
  }

  private finalizeHost(host: HostState, error: Error): void {
    if (host.finalized) {
      return
    }
    host.finalized = true
    clearTimeout(host.startTimer)
    if (!host.ready) {
      host.rejectReady(error)
    }
    if (this.host === host) {
      this.host = undefined
    }

    for (const pending of Array.from(this.pendingRuns.values())) {
      if (pending.generation !== host.generation) {
        continue
      }
      this.pendingRuns.delete(pending.runId)
      if (pending.abortTimer) {
        clearTimeout(pending.abortTimer)
      }
      pending.llmAbortController.abort(error)
      if (pending.signal && pending.onAbort) {
        pending.signal.removeEventListener('abort', pending.onAbort)
      }
      if (pending.started) {
        pending.resolveFinished({
          status: 'killed',
          exitCode: null,
          artifactPaths: [],
          storageChanges: [],
          error: error.message,
        })
      }
      else {
        pending.rejectStarted(error)
      }
      pending.release()
    }
  }

  private recycleIfIdle(host: HostState): void {
    if (this.host !== host || host.finalized || this.activeSlots > 0 || this.pendingRuns.size > 0 || !host.recycleReason) {
      return
    }
    this.drainHost(host, host.recycleReason)
  }

  private scheduleIdleRecycle(): void {
    if (this.activeSlots > 0 || this.pendingRuns.size > 0 || !this.host || this.host.finalized || this.shuttingDown) {
      return
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
    }
    const host = this.host
    this.idleTimer = setTimeout(() => {
      if (this.host === host && !host.finalized && this.activeSlots === 0 && this.pendingRuns.size === 0) {
        this.drainHost(host, 'idle')
      }
    }, IDLE_TIMEOUT_MS)
    this.idleTimer.unref()
  }

  private drainHost(host: HostState, reason: 'idle' | 'max-runs' | 'rss'): void {
    if (host.finalized || host.draining) {
      return
    }
    host.draining = true
    try {
      this.send(host, { type: 'host.drain', reason })
    }
    catch (error) {
      this.finalizeHost(host, error instanceof Error ? error : new Error(String(error)))
    }
  }
}

export const sandboxHostManager = new SandboxHostManager()
