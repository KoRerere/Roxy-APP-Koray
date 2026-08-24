import type {
  TaskMonitorBrowserAttachInput,
  TaskMonitorBrowserEventInput,
  TaskMonitorBrowserFinishedInput,
} from './types'
import {
  publishTaskMonitorBrowserAttached,
  publishTaskMonitorBrowserEvent,
  publishTaskMonitorBrowserFinished,
} from './transport'

/**
 * Profile lifecycle bridge used by runtime plugins.
 *
 * Scheduling owns exclusivity; this bridge owns only the frontend-facing
 * browser lifecycle stream. Keeping the two contracts separate prevents a
 * monitor subscriber or IPC failure from becoming a profile lock decision.
 */
export interface ProfileMonitor {
  attach: (input: TaskMonitorBrowserAttachInput) => void
  event: (input: TaskMonitorBrowserEventInput) => void
  finish: (input: TaskMonitorBrowserFinishedInput) => void
}

export const profileMonitor: ProfileMonitor = {
  attach: publishTaskMonitorBrowserAttached,
  event: publishTaskMonitorBrowserEvent,
  finish: publishTaskMonitorBrowserFinished,
}
