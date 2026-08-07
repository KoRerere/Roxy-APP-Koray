import type { AgentTaskScriptRunDTO } from '@roxy/shared/channel'

export type TaskTriggerType = 'manual' | 'once' | 'cron'

export type TaskScriptRun = AgentTaskScriptRunDTO

export type TaskLogStatus =
  | 'preparing'
  | 'running'
  | 'success'
  | 'partial_failed'
  | 'failed'
  | 'interrupted'
  | 'skipped'

export interface TaskLog {
  id: string
  user_id: string
  workspace_id: string
  task_id: number
  task_name: string
  template_id: number
  template_name: string
  template_type: 'script' | 'skill' | 'prompt'
  trigger_type: TaskTriggerType
  occurrence_id: string | null
  scheduled_at: string | null
  input: unknown
  window_dir_ids: string[]
  script_runs: TaskScriptRun[]
  conversation_id: string | null
  file_ids: string[]
  status: TaskLogStatus
  started_at: string
  ended_at: string | null
  end_reason_code: string | null
}

export interface CreateTaskLogInput {
  id: string
  userId: string
  workspaceId: string
  taskId: number
  taskName: string
  templateId: number
  templateName: string
  templateType: TaskLog['template_type']
  triggerType: TaskTriggerType
  scheduledAt?: string | null
  input: unknown
  startedAt?: string
}

export interface UpdateTaskLogExecutionInput {
  occurrenceId?: string | null
  windowDirIds?: string[]
  scriptRuns?: TaskScriptRun[]
}

export interface UpdateTaskLogAssociationsInput {
  conversationId?: string | null
  fileIds?: string[]
}

export interface FinishTaskLogInput extends UpdateTaskLogAssociationsInput {
  status: Exclude<TaskLogStatus, 'preparing' | 'running'>
  endedAt?: string
  endReasonCode?: string | null
  scriptRuns?: TaskScriptRun[]
}

export interface ListTaskLogsInput {
  userId: string
  workspaceId: string
  taskId?: number
  status?: TaskLogStatus
  triggerType?: TaskTriggerType
  limit?: number
  offset?: number
}

export interface TaskLogPage {
  items: TaskLog[]
  total: number
  limit: number
  offset: number
}

export type TaskLogStoreEvent
  = | { type: 'changed', log: TaskLog }
    | { type: 'deleted', logId: string }
