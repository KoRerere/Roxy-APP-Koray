import type { TaskErrorCode } from './errorCodes'
import { taskErrorLogMessage } from './errorCodes'

export class TaskRunAbortError extends Error {
  constructor(public readonly code: TaskErrorCode) {
    super(taskErrorLogMessage(code))
    this.name = 'AbortError'
  }
}
