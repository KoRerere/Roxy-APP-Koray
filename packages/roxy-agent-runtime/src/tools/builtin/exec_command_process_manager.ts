import { spawn } from 'node:child_process'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'

const DEFAULT_LIFETIME_MS = 10 * 60 * 1_000
const DEFAULT_MAX_PROCESSES = 64
const DEFAULT_BUFFER_BYTES = 1024 * 1024
const KILL_DRAIN_MS = 1_000
const COMPLETED_RETENTION_MS = 60_000
const IS_WINDOWS = process.platform === 'win32'

export type ExecCommandTerminationReason = 'timeout' | 'aborted' | 'killed'

export interface ExecCommandProcessEntry {
  session_id: number
  cmd: string
  workdir?: string
  child: ChildProcessWithoutNullStreams
  stdoutChunks: Buffer[]
  stderrChunks: Buffer[]
  startedAt: number
  lastUsedAt: number
  lifetimeTimer?: NodeJS.Timeout
  terminationReason?: ExecCommandTerminationReason
  closed: boolean
  exitCode?: number | null
  signal?: NodeJS.Signals | null
  tty: boolean
  startError?: string
  completedTimer?: NodeJS.Timeout
  operation?: Promise<unknown>
}

export interface ExecCommandProcessManagerOptions {
  lifetimeMs?: number
  maxProcesses?: number
  maxBufferBytes?: number
  nextSessionId?: () => number
}

export interface SpawnManagedProcessOptions {
  cmd: string
  workdir?: string
  file: string
  args: string[]
  tty: boolean
}

export interface ExecCommandSnapshot {
  output: string
  closed: boolean
  exitCode?: number | null
  signal?: NodeJS.Signals | null
  terminationReason?: ExecCommandTerminationReason
  startError?: string
}

export class ExecCommandProcessManager {
  private readonly entries = new Map<number, ExecCommandProcessEntry>()
  private readonly completed = new Map<number, ExecCommandProcessEntry>()
  private readonly lifetimeMs: number
  private readonly maxProcesses: number
  private readonly maxBufferBytes: number
  private readonly nextSessionId: () => number
  private sequence = 1

  constructor(options: ExecCommandProcessManagerOptions = {}) {
    this.lifetimeMs = options.lifetimeMs ?? DEFAULT_LIFETIME_MS
    this.maxProcesses = options.maxProcesses ?? DEFAULT_MAX_PROCESSES
    this.maxBufferBytes = options.maxBufferBytes ?? DEFAULT_BUFFER_BYTES
    this.nextSessionId = options.nextSessionId ?? (() => this.sequence++)
  }

  spawn(options: SpawnManagedProcessOptions): ExecCommandProcessEntry {
    this.enforceProcessLimit()
    const sessionId = this.allocateSessionId()
    const child = spawn(options.file, options.args, {
      cwd: options.workdir,
      shell: false,
      detached: !IS_WINDOWS,
      windowsHide: true,
    })
    const entry: ExecCommandProcessEntry = {
      session_id: sessionId,
      cmd: options.cmd,
      workdir: options.workdir,
      child,
      stdoutChunks: [],
      stderrChunks: [],
      startedAt: Date.now(),
      lastUsedAt: Date.now(),
      closed: false,
      tty: options.tty,
    }
    this.entries.set(sessionId, entry)

    child.stdout.on('data', (chunk: Buffer) => this.pushChunk(entry.stdoutChunks, chunk))
    child.stderr.on('data', (chunk: Buffer) => this.pushChunk(entry.stderrChunks, chunk))
    child.on('close', (code, signal) => {
      entry.closed = true
      entry.exitCode = code
      entry.signal = signal
      this.completeEntry(entry)
    })
    child.on('error', (error) => {
      entry.closed = true
      entry.exitCode = 1
      entry.startError = error.message
      this.pushChunk(entry.stderrChunks, Buffer.from(error.message))
      this.completeEntry(entry)
    })
    entry.lifetimeTimer = setTimeout(() => {
      entry.terminationReason = 'timeout'
      this.killEntry(entry, 'timeout')
    }, this.lifetimeMs)
    entry.lifetimeTimer.unref?.()
    return entry
  }

  get(sessionId: number): ExecCommandProcessEntry | undefined {
    return this.entries.get(sessionId) ?? this.completed.get(sessionId)
  }

  async withEntry<T>(
    sessionId: number,
    fn: (entry: ExecCommandProcessEntry) => Promise<T>,
  ): Promise<{ ok: true; value: T } | { ok: false; reason: 'unknown' | 'busy' }> {
    const entry = this.get(sessionId)
    if (!entry) {
      return { ok: false, reason: 'unknown' }
    }
    if (entry.operation) {
      return { ok: false, reason: 'busy' }
    }
    const operation = fn(entry)
    entry.operation = operation
    try {
      const value = await operation
      return { ok: true, value }
    } finally {
      if (entry.operation === operation) {
        entry.operation = undefined
      }
    }
  }

  snapshot(entry: ExecCommandProcessEntry): ExecCommandSnapshot {
    entry.lastUsedAt = Date.now()
    return {
      output: this.combinedOutput(entry),
      closed: entry.closed,
      exitCode: entry.exitCode,
      signal: entry.signal,
      terminationReason: entry.terminationReason,
      startError: entry.startError,
    }
  }

  remove(sessionId: number): void {
    const entry = this.entries.get(sessionId) ?? this.completed.get(sessionId)
    if (!entry) {
      return
    }
    this.clearTimer(entry)
    if (entry.completedTimer) {
      clearTimeout(entry.completedTimer)
      entry.completedTimer = undefined
    }
    this.entries.delete(sessionId)
    this.completed.delete(sessionId)
  }

  async killAndWait(entry: ExecCommandProcessEntry, reason: ExecCommandTerminationReason): Promise<void> {
    entry.terminationReason = reason
    this.killEntry(entry, reason)
    await this.waitForClose(entry, KILL_DRAIN_MS)
  }

  async waitForClose(entry: ExecCommandProcessEntry, timeoutMs: number): Promise<boolean> {
    if (entry.closed) {
      return true
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        cleanup()
        resolve(entry.closed)
      }, timeoutMs)
      const onClose = () => {
        cleanup()
        resolve(true)
      }
      const cleanup = () => {
        clearTimeout(timer)
        entry.child.off('close', onClose)
      }
      entry.child.once('close', onClose)
    })
  }

  async waitForOutputOrClose(
    entry: ExecCommandProcessEntry,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<'closed' | 'output' | 'timeout' | 'aborted'> {
    if (entry.closed) {
      return 'closed'
    }
    if (signal?.aborted) {
      return 'aborted'
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        cleanup()
        resolve(entry.closed ? 'closed' : 'timeout')
      }, timeoutMs)
      const onClose = () => {
        cleanup()
        resolve('closed')
      }
      const onOutput = () => {
        cleanup()
        resolve(entry.closed ? 'closed' : 'output')
      }
      const onAbort = () => {
        cleanup()
        resolve('aborted')
      }
      const cleanup = () => {
        clearTimeout(timer)
        entry.child.off('close', onClose)
        entry.child.stdout.off('data', onOutput)
        entry.child.stderr.off('data', onOutput)
        signal?.removeEventListener('abort', onAbort)
      }
      entry.child.once('close', onClose)
      entry.child.stdout.once('data', onOutput)
      entry.child.stderr.once('data', onOutput)
      signal?.addEventListener('abort', onAbort, { once: true })
    })
  }

  async waitForCloseOrTimeout(
    entry: ExecCommandProcessEntry,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<'closed' | 'timeout' | 'aborted'> {
    if (entry.closed) {
      return 'closed'
    }
    if (signal?.aborted) {
      return 'aborted'
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        cleanup()
        resolve(entry.closed ? 'closed' : 'timeout')
      }, timeoutMs)
      const onClose = () => {
        cleanup()
        resolve('closed')
      }
      const onAbort = () => {
        cleanup()
        resolve('aborted')
      }
      const cleanup = () => {
        clearTimeout(timer)
        entry.child.off('close', onClose)
        signal?.removeEventListener('abort', onAbort)
      }
      entry.child.once('close', onClose)
      signal?.addEventListener('abort', onAbort, { once: true })
    })
  }

  clear(): void {
    for (const entry of this.entries.values()) {
      this.killEntry(entry, 'killed')
      this.clearTimer(entry)
    }
    this.entries.clear()
    for (const entry of this.completed.values()) {
      if (entry.completedTimer) {
        clearTimeout(entry.completedTimer)
        entry.completedTimer = undefined
      }
    }
    this.completed.clear()
  }

  private allocateSessionId(): number {
    for (let attempts = 0; attempts < 1000; attempts++) {
      const id = this.nextSessionId()
      if (!this.entries.has(id) && !this.completed.has(id)) {
        return id
      }
    }
    throw new Error('unable to allocate exec_command session id')
  }

  private enforceProcessLimit(): void {
    if (this.entries.size < this.maxProcesses) {
      return
    }
    for (const [sessionId, entry] of this.entries) {
      if (entry.closed) {
        this.remove(sessionId)
        if (this.entries.size < this.maxProcesses) {
          return
        }
      }
    }
    const oldest = [...this.entries.values()].toSorted((a, b) => a.lastUsedAt - b.lastUsedAt)[0]
    if (oldest) {
      oldest.terminationReason = 'killed'
      this.killEntry(oldest, 'killed')
      this.remove(oldest.session_id)
    }
  }

  private pushChunk(chunks: Buffer[], chunk: Buffer): void {
    chunks.push(chunk)
    while (this.totalBytes(chunks) > this.maxBufferBytes && chunks.length > 1) {
      chunks.splice(1, 1)
    }
    if (this.totalBytes(chunks) > this.maxBufferBytes && chunks.length === 1) {
      chunks[0] = chunks[0]!.subarray(0, this.maxBufferBytes)
    }
  }

  private totalBytes(chunks: Buffer[]): number {
    return chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  }

  private combinedOutput(entry: ExecCommandProcessEntry): string {
    return Buffer.concat([...entry.stdoutChunks, ...entry.stderrChunks]).toString('utf8')
  }

  private clearTimer(entry: ExecCommandProcessEntry): void {
    if (entry.lifetimeTimer) {
      clearTimeout(entry.lifetimeTimer)
      entry.lifetimeTimer = undefined
    }
  }

  private completeEntry(entry: ExecCommandProcessEntry): void {
    this.clearTimer(entry)
    this.entries.delete(entry.session_id)
    this.completed.set(entry.session_id, entry)
    if (entry.completedTimer) {
      clearTimeout(entry.completedTimer)
    }
    entry.completedTimer = setTimeout(() => {
      if (this.completed.get(entry.session_id) === entry) {
        this.completed.delete(entry.session_id)
      }
    }, COMPLETED_RETENTION_MS)
    entry.completedTimer.unref?.()
  }

  private killEntry(entry: ExecCommandProcessEntry, reason: ExecCommandTerminationReason): void {
    if (entry.closed) {
      return
    }
    entry.terminationReason = reason
    if (entry.child.pid === undefined) {
      entry.child.kill('SIGKILL')
      return
    }
    if (!IS_WINDOWS) {
      try {
        process.kill(-entry.child.pid, 'SIGKILL')
        return
      } catch {
        // Fall back to killing the shell process below.
      }
    } else {
      const killer = spawn('taskkill', ['/pid', String(entry.child.pid), '/T', '/F'], { windowsHide: true })
      killer.on('error', () => {})
    }
    entry.child.kill('SIGKILL')
  }
}

export const defaultExecCommandProcessManager = new ExecCommandProcessManager()
