import type { TaskMonitorIpcEvent } from '@/core/task-monitor'
import type { AgentRunEvent } from '@roxy/shared/channel'

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
  event: AgentRunEvent
}

export interface WorkerHeartbeatMessage {
  type: 'heartbeat'
  protocolVersion: 1
  workerId: string
  pid: number
  timestamp: number
}

export interface WorkerTaskMonitorMessage {
  type: 'task_monitor'
  protocolVersion: 1
  event: TaskMonitorIpcEvent
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

export type WorkerToParentMessage
  = | WorkerReadyMessage
    | WorkerEventMessage
    | WorkerHeartbeatMessage
    | WorkerTaskMonitorMessage
    | WorkerResultMessage

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
  conversationId: string
  task: string
  timeoutMs: number
  turnId?: string
  dispatchTaskId?: string
  /** 本 worker 授权的窗口 dirId；非空时窗口类工具只能操作这些窗口 */
  allowedDirIds?: string[]
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

interface WorkerIpcSender {
  connected?: boolean
  send?: NodeJS.Process['send']
}

function formatIpcError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function logSendError(type: WorkerToParentMessage['type'], error: Error | null): void {
  if (error) {
    console.error(`[worker:ipc] Failed to send ${type} message: ${error.message}`)
  }
}

const sendCallbacks: Record<WorkerToParentMessage['type'], (error: Error | null) => void> = {
  ready: error => logSendError('ready', error),
  event: error => logSendError('event', error),
  heartbeat: error => logSendError('heartbeat', error),
  task_monitor: error => logSendError('task_monitor', error),
  result: error => logSendError('result', error),
}

/**
 * 返回 false 仅表示消息无法提交到 IPC 通道。send() 返回 false 代表队列背压，
 * 消息仍可能已入队，因此只记录 WARN 且返回 true，避免调用方重复发送。
 */
export function sendWorkerMessage(message: WorkerToParentMessage, sender: WorkerIpcSender = process): boolean {
  if (typeof sender.send !== 'function') {
    console.error(`[worker:ipc] Failed to send ${message.type} message: IPC send is unavailable`)
    return false
  }
  if (!sender.connected) {
    console.error(`[worker:ipc] Failed to send ${message.type} message: IPC channel is disconnected`)
    return false
  }

  try {
    const accepted = sender.send(message, sendCallbacks[message.type])
    if (!accepted) {
      console.warn(`[worker:ipc] IPC send queue is under backpressure for ${message.type} message`)
    }
    return true
  }
  catch (error) {
    console.error(`[worker:ipc] Failed to send ${message.type} message: ${formatIpcError(error)}`)
    return false
  }
}

export function sendReady(workerId: string): void {
  sendWorkerMessage({
    type: 'ready',
    protocolVersion: PROTOCOL_VERSION,
    workerId,
    pid: process.pid,
    startedAt: Date.now(),
  } satisfies WorkerReadyMessage)
}

export function sendEvent(workerId: string, event: AgentRunEvent): void {
  sendWorkerMessage({
    type: 'event',
    protocolVersion: PROTOCOL_VERSION,
    workerId,
    event,
  } satisfies WorkerEventMessage)
}

export function sendHeartbeat(workerId: string): void {
  sendWorkerMessage({
    type: 'heartbeat',
    protocolVersion: PROTOCOL_VERSION,
    workerId,
    pid: process.pid,
    timestamp: Date.now(),
  } satisfies WorkerHeartbeatMessage)
}

export function sendTaskMonitorEvent(event: TaskMonitorIpcEvent): boolean {
  return sendWorkerMessage({
    type: 'task_monitor',
    protocolVersion: PROTOCOL_VERSION,
    event,
  } satisfies WorkerTaskMonitorMessage)
}

export function sendResult(msg: Omit<WorkerResultMessage, 'type' | 'protocolVersion'>): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof process.send !== 'function' || !process.connected) {
      console.error('[worker:ipc] Failed to send result message: IPC channel is disconnected')
      process.exitCode = 1
      resolve(false)
      return
    }

    try {
      const accepted = process.send(
        {
          type: 'result',
          protocolVersion: PROTOCOL_VERSION,
          ...msg,
        } satisfies WorkerResultMessage,
        (err) => {
          if (err) {
            console.error(`[worker:ipc] Failed to send result message: ${err.message}`)
          }
          process.exitCode = err || msg.status === 'failed' ? 1 : 0
          resolve(!err)
        },
      )
      if (!accepted) {
        console.warn('[worker:ipc] IPC send queue is under backpressure for result message')
      }
    }
    catch (error) {
      console.error(`[worker:ipc] Failed to send result message: ${formatIpcError(error)}`)
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
