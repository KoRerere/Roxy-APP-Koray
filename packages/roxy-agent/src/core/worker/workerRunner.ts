import type { ParentToWorkerMessage, WorkerResult, WorkerResultStatus, WorkerToParentMessage } from './protocol'
import type { AgentRunEvent } from '@roxy/shared/channel'
import type { ChildProcess } from 'node:child_process'
import { fork } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { withWorkerId } from '@/core/agent-events/events'
import { streamEvents } from '@/core/agent-events/streamEvents'
import { taskMonitorHub } from '@/core/task-monitor'
import {
  WORKER_HEARTBEAT_INTERVAL_MS,
  WORKER_HEARTBEAT_TIMEOUT_MS,
} from './protocol'

export const WORKER_GRACEFUL_SHUTDOWN_MS = 15_000
export const WORKER_DESTROY_TIMEOUT_MS = 12_000
export const WORKER_FORCE_KILL_MS = 5_000
export const WORKER_RESULT_EXIT_GRACE_MS = WORKER_GRACEFUL_SHUTDOWN_MS
export const DEFAULT_WORKER_TIMEOUT_MS = 3_600_000
const WORKER_HEARTBEAT_CHECK_MS = 5_000

type RunnerState = 'starting' | 'running' | 'cancelling' | 'terminating' | 'done'

export class WorkerRunner {
  private child: ChildProcess | null = null
  private state: RunnerState = 'starting'
  private lastHeartbeatAt = Date.now()
  private heartbeatWatchdogHandle: NodeJS.Timeout | null = null
  private timeoutHandle: NodeJS.Timeout | null = null
  private gracefulHandle: NodeJS.Timeout | null = null
  private forceKillHandle: NodeJS.Timeout | null = null

  private protocolResult: WorkerResultStatus | null = null
  private protocolResultText = ''
  private protocolError: string | null = null
  private resultReceived = false
  private userStoppedEmitted = false
  private parentFailureError: string | null = null
  private postResultExitError: string | null = null

  private startedAt = Date.now()
  private resolvePromise!: (result: WorkerResult) => void
  readonly promise: Promise<WorkerResult>

  constructor(
    private readonly workerId: string,
    private readonly payloadPath: string,
    private readonly agentScriptPath: string,
    private readonly timeoutMs: number,
    private readonly writer: (event: AgentRunEvent) => void,
    private readonly onAbort?: AbortSignal,
  ) {
    this.promise = new Promise(resolve => (this.resolvePromise = resolve))
  }

  start(): void {
    this.startedAt = Date.now()
    this.lastHeartbeatAt = Date.now()

    const child = fork(
      this.agentScriptPath,
      ['worker', '--payload-file', this.payloadPath],
      {
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        execArgv: ['--experimental-strip-types'],
        execPath: process.execPath, // 需设置 execPath，否则会出现无法找到 electron node 导致进程无法启动
        env: {
          ...process.env,
          ROXY_MODE: 'worker',
          // 注入 workerId，供 worker logger 命名 {workerId}.log / {workerId}-perfmon.log
          ROXY_WORKER_ID: this.workerId,
        },
      },
    )
    this.child = child

    child.on('message', (msg: WorkerToParentMessage) => this.handleMessage(msg))
    child.on('error', (err) => {
      if (this.protocolResult === 'success') {
        this.postResultExitError = `Worker process error after successful result: ${err.message}`
      }
      else {
        this.parentFailureError ??= `Worker process error: ${err.message}`
      }
      console.error(`[WorkerRunner:${this.workerId}] child process error:`, err.message)
      this.handleChildExit(null, null)
    })
    child.on('exit', (code, signal) => this.handleChildExit(code, signal))

    // Parent abort (user stop) → cancel all workers
    this.onAbort?.addEventListener('abort', () => {
      if (this.state === 'running' && this.protocolResult !== 'success') {
        this.parentFailureError = 'Worker cancelled: User cancelled'
        this.sendCancel('user', this.parentFailureError)
        this.emitUserStopped(this.parentFailureError)
        this.enterGraceful()
      }
    }, { once: true })

    // Per-worker business timeout
    this.timeoutHandle = setTimeout(() => {
      if (this.state === 'running' && this.protocolResult !== 'success') {
        console.warn(`[WorkerRunner:${this.workerId}] timeout after ${this.timeoutMs}ms`)
        this.parentFailureError = `Worker timed out after ${this.timeoutMs}ms`
        this.sendCancel('timeout', this.parentFailureError)
        this.enterGraceful()
      }
    }, this.timeoutMs)
    this.timeoutHandle.unref()

    // Heartbeat watchdog: worker emits heartbeat every 15s; 60s means four missed beats.
    this.heartbeatWatchdogHandle = setInterval(() => {
      if (this.state !== 'running')
        return
      const idle = Date.now() - this.lastHeartbeatAt
      if (idle > WORKER_HEARTBEAT_TIMEOUT_MS) {
        this.handleHeartbeatTimeout(idle)
      }
    }, WORKER_HEARTBEAT_CHECK_MS)
    this.heartbeatWatchdogHandle.unref()

    this.state = 'running'

    if (this.onAbort?.aborted && this.protocolResult !== 'success') {
      this.parentFailureError = 'Worker cancelled: User cancelled'
      this.sendCancel('user', this.parentFailureError)
      this.emitUserStopped(this.parentFailureError)
      this.enterGraceful()
    }
  }

  private handleMessage(msg: WorkerToParentMessage): void {
    // Protocol version check
    if (msg.protocolVersion !== 1) {
      console.error(`[WorkerRunner:${this.workerId}] incompatible protocolVersion=${msg.protocolVersion}`)
      this.parentFailureError = `Worker protocol version mismatch: ${msg.protocolVersion}`
      this.sendCancel('parent_exit', 'Protocol version mismatch')
      this.enterGraceful()
      return
    }

    if (msg.type === 'ready') {
      this.lastHeartbeatAt = Date.now()
      console.log(`[WorkerRunner:${this.workerId}] ready pid=${msg.pid}`)
      // Unlink payload file now that child has read it
      fs.unlink(this.payloadPath).catch(err =>
        console.warn(`[WorkerRunner:${this.workerId}] Failed to unlink payload: ${err.message}`),
      )
    }
    else if (msg.type === 'heartbeat') {
      this.lastHeartbeatAt = Date.now()
    }
    else if (msg.type === 'event') {
      this.writer(withWorkerId(msg.event, this.workerId))
    }
    else if (msg.type === 'task_monitor') {
      taskMonitorHub.applyEvent(msg.event)
    }
    else if (msg.type === 'result') {
      // Only store first result message
      if (this.resultReceived)
        return

      this.resultReceived = true
      this.clearBusinessTimeout()
      this.clearHeartbeatWatchdog()
      this.clearGracefulTimers()

      if (this.parentFailureError) {
        console.warn(
          `[WorkerRunner:${this.workerId}] ignoring worker result after parent failure: ${this.parentFailureError}`,
        )
        this.enterResultExitGrace()
        return
      }

      this.protocolResult = msg.status
      this.protocolResultText = msg.result ?? ''
      this.protocolError = msg.error ?? (msg.status === 'failed' ? 'Worker failed without error message' : null)
      this.enterResultExitGrace()
    }
  }

  private handleChildExit(exitCode: number | null, signal: NodeJS.Signals | null): void {
    if (this.state === 'done')
      return

    this.clearTimers()

    const durationMs = Date.now() - this.startedAt

    let status: WorkerResultStatus = 'failed'
    let error: string | undefined = this.parentFailureError ?? this.protocolError ?? undefined

    if (!this.parentFailureError && this.protocolResult === 'success') {
      status = 'success'
      error = undefined
    }
    else if (!error) {
      error = this.createExitError(exitCode, signal)
    }

    if (status === 'success' && this.postResultExitError) {
      console.warn(`[WorkerRunner:${this.workerId}] ${this.postResultExitError}`)
    }

    this.writer(streamEvents.workerResult({
      taskId: this.workerId,
      status,
      exitCode,
      signal,
      error,
      durationMs,
    }))

    this.state = 'done'
    this.resolvePromise({
      worker: this.workerId,
      status,
      result: this.protocolResultText,
      error,
      exitCode,
      signal,
      durationMs,
    })
  }

  private handleHeartbeatTimeout(idleMs: number): void {
    if (this.state !== 'running')
      return
    this.state = 'terminating'
    this.clearTimers()

    this.parentFailureError = `Worker heartbeat expired after ${idleMs}ms (interval=${WORKER_HEARTBEAT_INTERVAL_MS}ms, timeout=${WORKER_HEARTBEAT_TIMEOUT_MS}ms)`
    console.error(`[WorkerRunner:${this.workerId}] ${this.parentFailureError}; SIGKILL`)

    this.forceKillChild()
  }

  private sendCancel(reason: 'user' | 'timeout' | 'parent_exit', message: string): void {
    if (!this.child || this.child.killed) {
      return
    }
    if (!this.child.connected) {
      console.error(`[WorkerRunner:${this.workerId}] Failed to send cancel message: IPC channel is disconnected`)
      return
    }

    const msg: ParentToWorkerMessage = {
      type: 'cancel',
      protocolVersion: 1,
      reason,
      message,
    }
    try {
      const accepted = this.child.send(msg, (error) => {
        if (error) {
          console.error(`[WorkerRunner:${this.workerId}] Failed to send cancel message: ${error.message}`)
        }
      })
      if (!accepted) {
        console.warn(`[WorkerRunner:${this.workerId}] IPC send queue is under backpressure for cancel message`)
      }
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[WorkerRunner:${this.workerId}] Failed to send cancel message: ${message}`)
    }
  }

  private emitUserStopped(error: string): void {
    if (this.userStoppedEmitted)
      return

    this.userStoppedEmitted = true
    this.writer(streamEvents.workerStopped({
      taskId: this.workerId,
      status: 'failed',
      reason: 'user',
      error,
    }))
  }

  private enterGraceful(): void {
    if (this.state === 'cancelling' || this.state === 'terminating' || this.state === 'done')
      return

    this.clearBusinessTimeout()
    this.clearHeartbeatWatchdog()
    this.state = 'cancelling'
    this.gracefulHandle = setTimeout(() => {
      if (this.state === 'done')
        return
      console.warn(`[WorkerRunner:${this.workerId}] graceful timeout, SIGTERM`)
      this.parentFailureError ??= 'Worker did not exit after cancel'
      this.child?.kill('SIGTERM')

      this.forceKillHandle = setTimeout(() => {
        if (this.state === 'done')
          return
        console.warn(`[WorkerRunner:${this.workerId}] SIGTERM timeout, SIGKILL`)
        this.parentFailureError ??= 'Worker did not exit after SIGTERM'
        this.forceKillChild()
      }, WORKER_FORCE_KILL_MS)
      this.forceKillHandle.unref()
    }, WORKER_GRACEFUL_SHUTDOWN_MS)
    this.gracefulHandle.unref()
  }

  private enterResultExitGrace(): void {
    if (this.state === 'done')
      return

    this.state = 'terminating'
    this.gracefulHandle = setTimeout(() => {
      if (this.state === 'done')
        return

      this.postResultExitError = `Worker did not exit after result within ${WORKER_RESULT_EXIT_GRACE_MS}ms`
      console.warn(`[WorkerRunner:${this.workerId}] ${this.postResultExitError}; SIGTERM`)
      this.child?.kill('SIGTERM')

      this.forceKillHandle = setTimeout(() => {
        if (this.state === 'done')
          return

        this.postResultExitError = `Worker did not exit after result SIGTERM within ${WORKER_FORCE_KILL_MS}ms`
        console.warn(`[WorkerRunner:${this.workerId}] ${this.postResultExitError}; SIGKILL`)
        this.forceKillChild()
      }, WORKER_FORCE_KILL_MS)
      this.forceKillHandle.unref()
    }, WORKER_RESULT_EXIT_GRACE_MS)
    this.gracefulHandle.unref()
  }

  private createExitError(exitCode: number | null, signal: NodeJS.Signals | null): string {
    const pid = this.child?.pid ?? 'unknown'
    return `Worker exited without successful result (worker=${this.workerId}, pid=${pid}, exitCode=${exitCode}, signal=${signal})`
  }

  private forceKillChild(): void {
    const pid = this.child?.pid
    if (!pid)
      return

    try {
      process.kill(pid, 'SIGKILL')
    }
    catch {
      // process may have already exited
    }
  }

  private clearTimers(): void {
    this.clearBusinessTimeout()
    this.clearHeartbeatWatchdog()
    this.clearGracefulTimers()
  }

  private clearGracefulTimers(): void {
    if (this.gracefulHandle) {
      clearTimeout(this.gracefulHandle)
      this.gracefulHandle = null
    }
    if (this.forceKillHandle) {
      clearTimeout(this.forceKillHandle)
      this.forceKillHandle = null
    }
  }

  private clearBusinessTimeout(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle)
      this.timeoutHandle = null
    }
  }

  private clearHeartbeatWatchdog(): void {
    if (this.heartbeatWatchdogHandle) {
      clearInterval(this.heartbeatWatchdogHandle)
      this.heartbeatWatchdogHandle = null
    }
  }
}

export async function clearPayloadFile(checkpointDir: string, parentRunId: string): Promise<void> {
  const dir = path.join(checkpointDir, 'worker-payloads')
  try {
    const files = await fs.readdir(dir)
    const orphans = files.filter(f => f.startsWith(`${parentRunId}-`))
    await Promise.allSettled(orphans.map(f => fs.unlink(path.join(dir, f))))
    if (orphans.length > 0) {
      console.warn(`[sweep] Removed ${orphans.length} orphan payload(s) for ${parentRunId}`)
    }
  }
  catch {
    // dir may not exist yet — ignore
  }
}
