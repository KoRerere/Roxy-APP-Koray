import type { TaskErrorCode } from './errorCodes'
import { agentUserTasksApi } from '@/api/agentApiClient'
import { AiAgentHttpError } from '@/api/errors'
import {
  TASK_HEARTBEAT_INTERVAL_MS,
  TASK_HEARTBEAT_MAX_FAILURES,
} from './constants'
import { TASK_ERROR_CODES, taskErrorLogMessage } from './errorCodes'

type TaskHeartbeatRenew = () => Promise<{ renewed: boolean, reason?: string | null }>

export class TaskRunAbortError extends Error {
  constructor(public readonly code: TaskErrorCode) {
    super(taskErrorLogMessage(code))
    this.name = 'AbortError'
  }
}

export class TaskLeaseHeartbeat {
  private timer?: NodeJS.Timeout
  private failures = 0
  private ticking = false
  private stopped = false

  constructor(
    private readonly taskId: number,
    private readonly taskLogId: string,
    private readonly leaseToken: string,
    private readonly abortController: AbortController,
    private readonly renew: TaskHeartbeatRenew = () => agentUserTasksApi.heartbeat(this.taskId, {
      taskLogId: this.taskLogId,
      leaseToken: this.leaseToken,
    }),
  ) {}

  start(): void {
    if (this.timer) {
      return
    }

    this.timer = setInterval(() => void this.tick(), TASK_HEARTBEAT_INTERVAL_MS)
    this.timer.unref()
  }

  stop(): void {
    this.stopped = true
    if (this.timer) {
      clearInterval(this.timer)
    }
    this.timer = undefined
  }

  private abort(code: TaskErrorCode) {
    if (!this.abortController.signal.aborted) {
      this.abortController.abort(new TaskRunAbortError(code))
    }
  }

  private async tick() {
    if (this.stopped || this.ticking || this.abortController.signal.aborted) {
      return
    }

    this.ticking = true
    try {
      const result = await this.renew()
      if (!result.renewed) {
        this.abort(TASK_ERROR_CODES.leaseLost)
        return
      }
      this.failures = 0
    }
    catch (error) {
      const status = error instanceof AiAgentHttpError ? error.status : undefined
      if (status !== undefined && status < 500) {
        this.abort(TASK_ERROR_CODES.heartbeatRejected)
        return
      }
      this.failures += 1
      if (this.failures >= TASK_HEARTBEAT_MAX_FAILURES) {
        this.abort(TASK_ERROR_CODES.heartbeatFailed)
      }
    }
    finally {
      this.ticking = false
    }
  }
}
