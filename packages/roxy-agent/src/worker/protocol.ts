import type { StreamEvent } from '../server/streamAdapter'

export const PROTOCOL_VERSION = 1
export const WORKER_HEARTBEAT_INTERVAL_MS = 15_000
export const WORKER_HEARTBEAT_TIMEOUT_MS = 60_000
export const WORKER_EXIT_FALLBACK_MS = 2_000

// ==================== Worker → Parent ====================

export interface WorkerReadyMessage {
  type: 'ready'
  protocolVersion: 1
  workerId: string
  pid: number
  startedAt: number
}

export interface WorkerEventMessage {
  type: 'event'
  protocolVersion: 1
  workerId: string
  sse: StreamEvent
}

export interface WorkerHeartbeatMessage {
  type: 'heartbeat'
  protocolVersion: 1
  workerId: string
  pid: number
  timestamp: number
}

export type WorkerResultStatus = 'success' | 'failed'

export interface WorkerResultMessage {
  type: 'result'
  protocolVersion: 1
  workerId: string
  status: WorkerResultStatus
  result: string
  error: string | null
  durationMs: number
}

export type WorkerToParentMessage = WorkerReadyMessage | WorkerEventMessage | WorkerHeartbeatMessage | WorkerResultMessage

// ==================== Parent → Worker ====================

export type CancelReason = 'user' | 'timeout' | 'parent_exit'

export interface ParentCancelMessage {
  type: 'cancel'
  protocolVersion: 1
  reason: CancelReason
  message: string
}

export type ParentToWorkerMessage = ParentCancelMessage

// ==================== Payload file ====================

export interface WorkerPayload {
  protocolVersion: 1
  workerId: string
  parentRunId: string
  conversationId?: string
  task: string
  timeoutMs: number
  turnId?: string
}

// ==================== Result merged by parent ====================

export interface WorkerResult {
  worker: string
  status: WorkerResultStatus
  result: string
  error?: string
  exitCode: number | null
  signal: NodeJS.Signals | null
  durationMs: number
}

// ==================== Send helpers ====================

export function sendReady(workerId: string): void {
  process.send!({
    type: 'ready',
    protocolVersion: PROTOCOL_VERSION,
    workerId,
    pid: process.pid,
    startedAt: Date.now(),
  } satisfies WorkerReadyMessage)
}

export function sendEvent(workerId: string, sse: StreamEvent): void {
  process.send!({
    type: 'event',
    protocolVersion: PROTOCOL_VERSION,
    workerId,
    sse,
  } satisfies WorkerEventMessage)
}

export function sendHeartbeat(workerId: string): void {
  try {
    process.send!({
      type: 'heartbeat',
      protocolVersion: PROTOCOL_VERSION,
      workerId,
      pid: process.pid,
      timestamp: Date.now(),
    } satisfies WorkerHeartbeatMessage)
  }
  catch {
    // IPC channel may already be closing.
  }
}

export function sendResult(msg: Omit<WorkerResultMessage, 'type' | 'protocolVersion'>): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof process.send !== 'function' || !process.connected) {
      process.exitCode = 1
      resolve(false)
      return
    }

    try {
      process.send(
        {
          type: 'result',
          protocolVersion: PROTOCOL_VERSION,
          ...msg,
        } satisfies WorkerResultMessage,
        (err) => {
          process.exitCode = err || msg.status === 'failed' ? 1 : 0
          resolve(!err)
        },
      )
    }
    catch {
      process.exitCode = 1
      resolve(false)
    }
  })
}

export function closeIpcAndExit(exitCode: number): void {
  process.exitCode = exitCode

  if (typeof process.disconnect === 'function' && process.connected) {
    try {
      process.disconnect()
    }
    catch {
      // IPC may already be closing.
    }
  }

  const exitHandle = setTimeout(() => {
    process.exit(exitCode)
  }, WORKER_EXIT_FALLBACK_MS)
  exitHandle.unref()
}
