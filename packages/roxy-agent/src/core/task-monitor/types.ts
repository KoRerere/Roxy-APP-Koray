import type {
  AgentTaskMonitorBrowserEvent,
  AgentTaskMonitorBrowserSession,
  AgentTaskMonitorEventStage,
  AgentTaskMonitorSnapshot,
  AgentTaskMonitorSourceType,
  AgentTaskMonitorTask,
} from '@roxy/shared/channel'

export type TaskMonitorSourceType = AgentTaskMonitorSourceType
export type TaskMonitorBrowserEventStage = AgentTaskMonitorEventStage

export interface TaskMonitorTaskInput {
  taskId: string
  title: string
  sourceType: TaskMonitorSourceType
  conversationId?: string
  runId?: string
}

export interface TaskMonitorBrowserAttachInput {
  taskId: string
  browserId: string
  dirId?: string
  label?: string
  ws?: string
  browserType?: string
}

export interface TaskMonitorBrowserEventInput {
  taskId: string
  browserId?: string
  dirId?: string
  stage: TaskMonitorBrowserEventStage
  toolName: string
  input?: Record<string, unknown>
  result?: string
  success: boolean
  errorMessage?: string
  durationMs?: number
  timestamp?: number
  workerId?: string
  conversationId?: string
}

export interface TaskMonitorBrowserFinishedInput {
  taskId: string
  browserId?: string
  dirId?: string
}

export type TaskMonitorBrowserEvent = AgentTaskMonitorBrowserEvent
export type TaskMonitorBrowserSession = AgentTaskMonitorBrowserSession
export type TaskMonitorTask = AgentTaskMonitorTask
export type TaskMonitorSnapshot = AgentTaskMonitorSnapshot

export type TaskMonitorIpcEvent
  = | { type: 'task_started', data: TaskMonitorTaskInput }
    | { type: 'task_finished', data: { taskId: string } }
    | { type: 'browser_attached', data: TaskMonitorBrowserAttachInput }
    | { type: 'browser_event', data: TaskMonitorBrowserEventInput }
    | { type: 'browser_finished', data: TaskMonitorBrowserFinishedInput }
