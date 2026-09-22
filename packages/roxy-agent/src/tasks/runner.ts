import type { PreparedTaskSkill } from './executors/agent'
import type {
  PreparedTaskScript,
  ScriptExecutionPlan,
} from './executors/script'
import type { ResolvedTaskWindow, TaskExecutorResult, TaskRunTrigger } from './types'
import type { UserTaskDto } from '@/api/agentApiClient'
import type { TaskLog } from '@/database/tasks'
import type { ResolvedTemplate } from '@/services/templateService'
import { serializeTemplateRef } from '@roxy/shared'
import { randomUUID } from 'node:crypto'
import {
  agentUserTasksApi,
} from '@/api/agentApiClient'
import { env } from '@/config'
import { executionCenter } from '@/core/registry/executionCenter'
import { taskLogStore } from '@/database/tasks'
import { resolveTemplate } from '@/services/templateService'
import { DEFAULT_SCRIPT_TASK_CONCURRENCY, TASK_TRIGGER_LEEWAY_MS } from './constants'
import { TASK_ERROR_CODES } from './errorCodes'
import { executeAgentTask, prepareTaskSkill } from './executors/agent'
import {
  createScriptExecutionPlan,
  executeScriptTask,
  prepareTaskScript,
} from './executors/script'
import { TaskRunAbortError } from './runAbortError'
import { closeTaskBrowserWindows } from './windowLifecycle'
import {
  reserveAvailableTaskWindows,
  windowReservationRegistry,
} from './windowReservation'

export interface StartedTaskRun {
  log: TaskLog
  completion: Promise<TaskLog>
}

interface ActiveTaskRun {
  logId: string
  abortController: AbortController
  completion: Promise<TaskLog>
}

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is not configured`)
  }
  return value
}

function taskInput(task: UserTaskDto, template: ResolvedTemplate): unknown {
  if (template.kind === 'script') {
    const params = task.metadata.params
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      throw new Error('Task snapshot is missing script parameters')
    }

    return params
  }

  const prompt = task.metadata.prompt
  if (template.kind === 'skill') {
    return typeof prompt === 'string' ? prompt.trim() : ''
  }
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('Task snapshot is missing an execution prompt')
  }

  return prompt.trim()
}

export function resolveTaskConcurrency(metadata: Record<string, unknown>): number {
  const concurrency = metadata.concurrency
  if (
    typeof concurrency !== 'number'
    || !Number.isSafeInteger(concurrency)
    || concurrency < 1
  ) {
    return DEFAULT_SCRIPT_TASK_CONCURRENCY
  }

  return concurrency
}

function validateDefinition(task: UserTaskDto, template: ResolvedTemplate): void {
  const workspaceId = requireEnv(env.ROXY_WORKSPACE_ID, 'ROXY_WORKSPACE_ID')
  if (task.workspaceId !== workspaceId || template.workspaceId !== workspaceId) {
    throw new TaskRunAbortError(TASK_ERROR_CODES.taskWorkspaceMismatch)
  }
  if (template.ref.namespace !== 'user' || task.userTemplateId !== template.id) {
    throw new TaskRunAbortError(TASK_ERROR_CODES.taskTemplateMismatch)
  }
}

function resolveTaskTemplate(task: UserTaskDto): Promise<ResolvedTemplate> {
  return resolveTemplate(serializeTemplateRef('user', task.userTemplateId))
}

function validateTriggerOwner(task: UserTaskDto, triggerType: TaskRunTrigger['triggerType']): void {
  if (triggerType !== 'manual' && task.creatorUserId !== requireEnv(env.ROXY_USER_ID, 'ROXY_USER_ID')) {
    throw new TaskRunAbortError(TASK_ERROR_CODES.taskScheduleForbidden)
  }
}

function abortResult(signal: AbortSignal): TaskExecutorResult {
  const reason = signal.reason
  return {
    status: 'interrupted',
    fileIds: [],
    endReasonCode: reason instanceof TaskRunAbortError
      ? reason.code
      : TASK_ERROR_CODES.taskInterrupted,
  }
}

export class TaskRunner {
  private readonly active = new Map<number, ActiveTaskRun>()
  private stopping = false

  async start(taskId: number, trigger: TaskRunTrigger): Promise<StartedTaskRun> {
    if (this.stopping) {
      throw new Error('Task runner is shutting down')
    }

    const task = await agentUserTasksApi.getById(taskId)
    validateTriggerOwner(task, trigger.triggerType)
    const template = await resolveTaskTemplate(task)
    const input = taskInput(task, template)

    const log = taskLogStore.create({
      id: randomUUID(),
      userId: requireEnv(env.ROXY_USER_ID, 'ROXY_USER_ID'),
      workspaceId: requireEnv(env.ROXY_WORKSPACE_ID, 'ROXY_WORKSPACE_ID'),
      taskId: task.id,
      taskName: task.name,
      templateId: template.id,
      templateName: template.name,
      templateType: template.kind,
      triggerType: trigger.triggerType,
      scheduledAt: trigger.scheduledAt ?? null,
      input,
    })

    try {
      validateDefinition(task, template)
    }
    catch (error) {
      const reason = error instanceof TaskRunAbortError ? error : undefined
      const finished = taskLogStore.finish(log.id, {
        status: 'failed',
        endReasonCode: reason?.code ?? TASK_ERROR_CODES.taskExecutionFailed,
      })

      return {
        log: finished,
        completion: Promise.resolve(finished),
      }
    }

    // 本地单次 timer 到点后，旧版租约造成的自动关闭不能否决这次执行。
    // 仅放行仍匹配当前单次计划且处于触发宽限期内的请求。
    const scheduledAt = trigger.scheduledAt ? Date.parse(trigger.scheduledAt) : Number.NaN
    const lateness = Date.now() - scheduledAt
    const dueOnceTrigger = trigger.triggerType === 'once' && task.planType === 'once'
      && !!task.executeAt && Date.parse(task.executeAt) === scheduledAt
      && lateness >= 0 && lateness <= TASK_TRIGGER_LEEWAY_MS
    if (trigger.triggerType !== 'manual' && !task.enabled && !dueOnceTrigger) {
      const skipped = taskLogStore.finish(log.id, {
        status: 'skipped',
        endReasonCode: TASK_ERROR_CODES.taskDisabled,
      })
      return { log: skipped, completion: Promise.resolve(skipped) }
    }

    if (this.active.has(taskId)) {
      const skipped = taskLogStore.finish(log.id, {
        status: 'skipped',
        endReasonCode: TASK_ERROR_CODES.taskAlreadyRunning,
      })
      return {
        log: skipped,
        completion: Promise.resolve(skipped),
      }
    }

    const abortController = new AbortController()
    const completion = Promise.resolve()
      .then(() => this.execute(log, task, template, input, trigger, abortController))
      .then((finished) => {
        executionCenter.finish(log.id, finished.status === 'success' ? 'completed' : finished.status === 'interrupted' ? 'cancelled' : 'failed', {
          taskId: task.id,
          endReasonCode: finished.end_reason_code,
        })
        return finished
      }, (error) => {
        executionCenter.finish(log.id, 'failed', { taskId: task.id })
        throw error
      })
      .finally(() => {
        if (this.active.get(taskId)?.completion === completion) {
          this.active.delete(taskId)
        }
      })
    this.active.set(taskId, { logId: log.id, abortController, completion })
    executionCenter.register({
      id: log.id,
      source: 'scheduled_task',
      conversationId: log.conversation_id ?? undefined,
      title: task.name,
      metadata: { taskId: task.id, triggerType: trigger.triggerType },
      cancel: () => this.stop(log.id),
    })
    executionCenter.start(log.id)
    return { log, completion }
  }

  async run(taskId: number, trigger: TaskRunTrigger): Promise<TaskLog> {
    const started = await this.start(taskId, trigger)
    return started.completion
  }

  async recordMissed(
    taskId: number,
    trigger: Exclude<TaskRunTrigger['triggerType'], 'manual'>,
    scheduledAt: string,
  ): Promise<TaskLog> {
    const task = await agentUserTasksApi.getById(taskId)
    validateTriggerOwner(task, trigger)
    const template = await resolveTaskTemplate(task)
    const input = taskInput(task, template)

    validateDefinition(task, template)

    const log = taskLogStore.create({
      id: randomUUID(),
      userId: requireEnv(env.ROXY_USER_ID, 'ROXY_USER_ID'),
      workspaceId: requireEnv(env.ROXY_WORKSPACE_ID, 'ROXY_WORKSPACE_ID'),
      taskId: task.id,
      taskName: task.name,
      templateId: template.id,
      templateName: template.name,
      templateType: template.kind,
      triggerType: trigger,
      scheduledAt,
      input,
    })
    return taskLogStore.finish(log.id, {
      status: 'skipped',
      endReasonCode: TASK_ERROR_CODES.missedTrigger,
    })
  }

  async stopAll(): Promise<void> {
    this.stopping = true
    const active = Array.from(this.active.values())
    for (const run of active) {
      if (!run.abortController.signal.aborted) {
        run.abortController.abort(new TaskRunAbortError(TASK_ERROR_CODES.agentShutdown))
      }
    }
    await Promise.allSettled(active.map(run => run.completion))
  }

  stop(logId: string): boolean {
    const run = Array.from(this.active.values()).find(activeRun => activeRun.logId === logId)
    if (!run || run.abortController.signal.aborted) {
      return false
    }

    run.abortController.abort(new TaskRunAbortError(TASK_ERROR_CODES.taskInterrupted))
    return true
  }

  private async execute(
    log: TaskLog,
    task: UserTaskDto,
    template: ResolvedTemplate,
    input: unknown,
    trigger: TaskRunTrigger,
    abortController: AbortController,
  ): Promise<TaskLog> {
    let cleanupPrepared: (() => Promise<void>) | undefined
    let result: TaskExecutorResult | undefined
    let scriptPlan: ScriptExecutionPlan | undefined
    let windows: ResolvedTaskWindow[] = []

    try {
      let preparedScript: PreparedTaskScript | undefined
      let preparedSkill: PreparedTaskSkill | undefined

      try {
        if (template.kind === 'script') {
          preparedScript = await prepareTaskScript(template, abortController.signal)
          cleanupPrepared = preparedScript.cleanup
        }
        else if (template.kind === 'skill') {
          preparedSkill = await prepareTaskSkill(template, abortController.signal)
        }
      }
      catch (error) {
        if (abortController.signal.aborted) {
          result = abortResult(abortController.signal)
        }
        else {
          console.error(`[task] Failed to prepare task asset taskId=${task.id}:`, error)
          result = {
            status: 'failed',
            fileIds: [],
            endReasonCode: TASK_ERROR_CODES.taskAssetInvalid,
          }
        }
        return this.finishLocal(log.id, template.kind, result)
      }

      try {
        windows = await reserveAvailableTaskWindows(task.windowIds, log.id)
      }
      catch (error) {
        if (abortController.signal.aborted) {
          result = abortResult(abortController.signal)
        }
        else {
          console.error(`[task] Failed to resolve task windows taskId=${task.id}:`, error)
          result = {
            status: 'failed',
            fileIds: [],
            endReasonCode: TASK_ERROR_CODES.windowStateUnavailable,
          }
        }
        return this.finishLocal(log.id, template.kind, result)
      }

      if (task.windowIds.length > 0 && windows.length === 0) {
        result = {
          status: 'failed',
          fileIds: [],
          endReasonCode: TASK_ERROR_CODES.noAvailableWindows,
        }
        return this.finishLocal(log.id, template.kind, result)
      }

      if (abortController.signal.aborted) {
        result = abortResult(abortController.signal)
        return this.finishLocal(log.id, template.kind, result)
      }

      if (preparedScript) {
        scriptPlan = createScriptExecutionPlan(
          log.id,
          task.name,
          preparedScript,
          windows,
          input,
          resolveTaskConcurrency(task.metadata),
        )
      }

      taskLogStore.markRunning(log.id, {
        occurrenceId: trigger.scheduledAt ?? null,
        windowDirIds: windows.map(window => window.dirId),
        scriptRuns: scriptPlan?.scriptRuns,
      })

      if (scriptPlan) {
        result = await executeScriptTask(scriptPlan, abortController.signal)
      }
      else {
        result = await executeAgentTask({
          taskName: task.name,
          templateName: template.name,
          taskLogId: log.id,
          prompt: String(input),
          windows,
          signal: abortController.signal,
          skill: preparedSkill,
          onConversationCreated: (conversationId) => {
            taskLogStore.updateAssociations(log.id, { conversationId })
            executionCenter.register({
              id: log.id,
              source: 'scheduled_task',
              conversationId,
            })
          },
        })
      }

      if (abortController.signal.aborted) {
        result = {
          ...abortResult(abortController.signal),
          scriptRuns: result.scriptRuns ?? scriptPlan?.scriptRuns,
        }
      }
      return this.finishLocal(log.id, template.kind, result)
    }
    catch (error) {
      if (abortController.signal.aborted) {
        result = {
          ...abortResult(abortController.signal),
          scriptRuns: scriptPlan?.scriptRuns,
        }
      }
      else {
        console.error(`[task] Task execution failed taskId=${task.id}:`, error)
        result = {
          status: 'failed',
          fileIds: [],
          scriptRuns: scriptPlan?.scriptRuns,
          endReasonCode: TASK_ERROR_CODES.taskExecutionFailed,
        }
      }
      return this.finishLocal(log.id, template.kind, result)
    }
    finally {
      const closedWindowDirIds = new Set(result?.closedWindowDirIds ?? [])
      await closeTaskBrowserWindows(
        windows.filter(window => !closedWindowDirIds.has(window.dirId)),
      )
      windowReservationRegistry.release(log.id)
      await cleanupPrepared?.().catch(error => console.warn(`[task] Failed to clean prepared task asset ${log.id}:`, error))
    }
  }

  private finishLocal(
    logId: string,
    templateType: ResolvedTemplate['kind'],
    result: TaskExecutorResult,
  ): TaskLog {
    if (templateType === 'script') {
      return taskLogStore.finish(logId, {
        status: result.status,
        scriptRuns: result.scriptRuns ?? [],
        endReasonCode: result.endReasonCode,
      })
    }

    return taskLogStore.finish(logId, {
      status: result.status,
      conversationId: result.conversationId,
      fileIds: result.fileIds,
      endReasonCode: result.endReasonCode,
    })
  }
}

export const taskRunner = new TaskRunner()
