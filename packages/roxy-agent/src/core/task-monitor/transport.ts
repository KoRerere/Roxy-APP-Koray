import type {
  TaskMonitorBrowserAttachInput,
  TaskMonitorBrowserEventInput,
  TaskMonitorBrowserFinishedInput,
  TaskMonitorIpcEvent,
  TaskMonitorTaskInput,
} from './types'
import { profileMonitorHub } from './hub'

function publish(event: TaskMonitorIpcEvent): void {
  profileMonitorHub.applyEvent(event)
}

export function publishTaskMonitorTaskStarted(data: TaskMonitorTaskInput): void {
  publish({ type: 'task_started', data })
}

export function publishTaskMonitorTaskFinished(taskId: string): void {
  publish({ type: 'task_finished', data: { taskId } })
}

export function publishTaskMonitorBrowserAttached(data: TaskMonitorBrowserAttachInput): void {
  publish({ type: 'browser_attached', data })
}

export function publishTaskMonitorBrowserEvent(data: TaskMonitorBrowserEventInput): void {
  publish({ type: 'browser_event', data })
}

export function publishTaskMonitorBrowserFinished(data: TaskMonitorBrowserFinishedInput): void {
  publish({ type: 'browser_finished', data })
}
