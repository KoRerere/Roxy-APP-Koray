import type {
  TaskLog,
} from '@/database/tasks'
import type { AgentTaskExecutionReplay, AgentTaskLogDTO } from '@roxy/shared/channel'
import { env } from '@/config'
import { taskLogStore } from '@/database/tasks'
import { taskRunner } from '@/tasks/runner'
import { taskScheduler } from '@/tasks/scheduler'
import {
  replayTaskExecutionFromLocalStorage,
  taskExecutionDetailHub,
} from './taskExecutionDetails'

export type TaskLogDTO = AgentTaskLogDTO

export type StopTaskLogResult = 'stopping' | 'not_found' | 'not_active'
export type DeleteTaskLogResult = 'deleted' | 'not_found' | 'active'

function requiredScopeValue(value: string | undefined, name: string): string {
  if (!value)
    throw new Error(`${name} is not configured`)
  return value
}

function currentScope() {
  return {
    userId: requiredScopeValue(env.ROXY_USER_ID, 'ROXY_USER_ID'),
    workspaceId: requiredScopeValue(env.ROXY_WORKSPACE_ID, 'ROXY_WORKSPACE_ID'),
  }
}

function durationMs(log: TaskLog, now: number): number | null {
  const startedAt = Date.parse(log.started_at)
  const endedAt = log.ended_at ? Date.parse(log.ended_at) : now
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt))
    return null
  return Math.max(0, endedAt - startedAt)
}

export function toTaskLogDTO(log: TaskLog, now = Date.now()): TaskLogDTO {
  return {
    id: log.id,
    taskId: log.task_id,
    taskName: log.task_name,
    templateId: log.template_id,
    templateName: log.template_name,
    templateType: log.template_type,
    triggerType: log.trigger_type,
    occurrenceId: log.occurrence_id,
    scheduledAt: log.scheduled_at,
    input: log.input,
    windowDirIds: log.window_dir_ids,
    scriptRuns: log.script_runs,
    conversationId: log.conversation_id,
    fileIds: log.file_ids,
    status: log.status,
    success: log.status === 'success',
    startedAt: log.started_at,
    endedAt: log.ended_at,
    durationMs: durationMs(log, now),
    endReasonCode: log.end_reason_code,
  }
}

export function listAllTaskLogs(): TaskLogDTO[] {
  const scope = currentScope()
  const now = Date.now()
  const items: TaskLogDTO[] = []
  const limit = 200
  let offset = 0
  while (true) {
    const page = taskLogStore.list({ ...scope, limit, offset })
    items.push(...page.items.map(log => toTaskLogDTO(log, now)))
    offset += page.items.length
    if (page.items.length === 0 || offset >= page.total)
      break
  }
  return items
}

export function replayTaskExecution(logId: string): AgentTaskExecutionReplay | null {
  const scope = currentScope()
  const log = taskLogStore.getById(logId, scope.userId, scope.workspaceId)
  if (!log) {
    return null
  }

  const liveReplay = taskExecutionDetailHub.replay(logId)
  if (liveReplay.events.length > 0) {
    return liveReplay
  }

  return taskExecutionDetailHub.restore(replayTaskExecutionFromLocalStorage(log))
}

export function stopTaskLog(logId: string): StopTaskLogResult {
  const scope = currentScope()
  const log = taskLogStore.getById(logId, scope.userId, scope.workspaceId)
  if (!log)
    return 'not_found'
  if (log.status !== 'preparing' && log.status !== 'running')
    return 'not_active'
  return taskRunner.stop(logId) ? 'stopping' : 'not_active'
}

export function deleteTaskLog(logId: string): DeleteTaskLogResult {
  const scope = currentScope()
  const result = taskLogStore.delete(logId, scope.userId, scope.workspaceId)
  if (result === 'deleted') {
    taskExecutionDetailHub.delete(logId)
  }

  return result
}

export async function runTaskNow(taskId: number): Promise<TaskLogDTO> {
  const started = await taskRunner.start(taskId, { triggerType: 'manual', scheduledAt: null })
  void started.completion.catch(error =>
    console.error(`[task-service] Task completion failed taskId=${taskId}:`, error))
  return toTaskLogDTO(started.log)
}

export function syncTasks() {
  return taskScheduler.sync()
}
