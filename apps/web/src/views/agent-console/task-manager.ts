import type { MyTemplateKind, UserTemplateDTO } from './my-templates'
import type { AgentTaskLogDTO, AgentTaskLogStatus } from '@roxy/shared/channel'
import { UserTaskCreatePlanTypeEnum, UserTaskUpdatePlanTypeEnum } from '@roxy/agent-api'
import { normalizeMyTemplateKind } from './my-templates'

export type TaskPlanType = 'cron' | 'manual' | 'once'
export type TaskPlanStatus = 'manual' | 'paused' | 'scheduled'
export type TaskRuntimeStatus = 'idle' | 'running'
export type TaskDisplayStatus = TaskPlanStatus | Extract<AgentTaskLogStatus, 'preparing' | 'running'>

const DEFAULT_TASK_CONCURRENCY = 4
const MAX_TASK_CONCURRENCY = 256

const USER_TASK_CREATE_PLAN_TYPES: Readonly<Record<TaskPlanType, UserTaskCreatePlanTypeEnum>> = {
  cron: UserTaskCreatePlanTypeEnum.Cron,
  manual: UserTaskCreatePlanTypeEnum.Manual,
  once: UserTaskCreatePlanTypeEnum.Once,
}

const USER_TASK_UPDATE_PLAN_TYPES: Readonly<Record<TaskPlanType, UserTaskUpdatePlanTypeEnum>> = {
  cron: UserTaskUpdatePlanTypeEnum.Cron,
  manual: UserTaskUpdatePlanTypeEnum.Manual,
  once: UserTaskUpdatePlanTypeEnum.Once,
}

const TASK_ERROR_I18N_KEYS: Readonly<Record<string, string>> = {
  TASK_INTERRUPTED: '任务执行已中断',
  TASK_WORKSPACE_MISMATCH: '任务或模板不属于当前工作区',
  TASK_TEMPLATE_MISMATCH: '任务引用的模板不匹配',
  TASK_ALREADY_RUNNING: '当前设备上已有该任务正在运行',
  MISSED_TRIGGER: '计划触发延迟超过五分钟，本次执行已跳过',
  AGENT_SHUTDOWN: 'Agent 关闭期间任务执行被中断',
  AGENT_RESTARTED: 'Agent 重启导致任务执行中断',
  TASK_ASSET_INVALID: '任务资源无效或已损坏',
  WINDOW_STATE_UNAVAILABLE: '无法读取任务窗口状态',
  NO_AVAILABLE_WINDOWS: '配置的浏览器窗口均不可用',
  LEASE_SERVICE_UNAVAILABLE: '任务执行协调服务暂时不可用',
  TASK_DISABLED: '任务已被禁用',
  TASK_EXECUTED_BY_OTHER_USER: '任务已被其他客户端抢占',
  TASK_EXECUTION_FAILED: '任务执行失败，请稍后重试',
  AGENT_EXECUTION_FAILED: '任务执行失败，请稍后重试',
  SCRIPT_EXECUTION_FAILED: '所有脚本执行均失败',
  PARTIAL_WINDOW_FAILURE: '部分窗口的脚本执行失败',
  ARTIFACT_UPLOAD_PARTIAL_FAILURE: '部分任务产物上传失败',
  LEASE_LOST: '任务执行租约已失效',
  HEARTBEAT_REJECTED: '任务心跳请求被拒绝',
  HEARTBEAT_FAILED: '任务心跳连续失败',
}

export interface UserTaskDTO {
  id: number
  workspaceId: string
  name: string
  userTemplateId: number
  windowIds: string[]
  metadata: Record<string, unknown>
  planType: TaskPlanType
  cron?: string | null
  timezone?: string | null
  executeAt?: string | null
  nextExecuteAt?: string | null
  enabled: boolean
  runtimeStatus?: TaskRuntimeStatus
  runtimeTaskLogId?: string | null
  runtimeStartedAt?: string | null
  runtimeLastHeartbeatAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface UserTaskPage {
  items: UserTaskDTO[]
  total: number
  limit: number
  offset: number
}

export interface TaskTemplateOption {
  kind?: MyTemplateKind
  label: string
  value: number
}

export interface TaskWindowOption {
  id: string
  code: string
  windowSortNum?: number
  workspaceName?: string
  projectId?: string
  projectName?: string
  iconName: string
  isOpen: boolean
  name: string
  remark: string
}

export interface TaskDialogPayload {
  name: string
  userTemplateId: number
  windowIds: string[]
  planType: TaskPlanType
  cron: string | null
  timezone: string | null
  executeAt: string | null
  enabled: boolean
  concurrency: number | null
}

export interface TaskDialogInitialValues extends Omit<TaskDialogPayload, 'concurrency'> {
  id?: number
  nextExecuteAt?: string | null
  concurrency?: number | null
}

export function getDefaultTaskConcurrency(): number {
  const cpuCount = navigator.hardwareConcurrency
  if (
    typeof cpuCount !== 'number'
    || !Number.isSafeInteger(cpuCount)
    || cpuCount < 1
  ) {
    return DEFAULT_TASK_CONCURRENCY
  }

  const concurrency = cpuCount + 2
  return Math.min(Number.isSafeInteger(concurrency) ? concurrency : DEFAULT_TASK_CONCURRENCY, MAX_TASK_CONCURRENCY)
}

export function readTaskConcurrency(metadata: Record<string, unknown>): number | undefined {
  const concurrency = metadata.concurrency
  if (
    typeof concurrency !== 'number'
    || !Number.isSafeInteger(concurrency)
    || concurrency < 1
  ) {
    return undefined
  }

  return concurrency
}

export function buildTaskMetadata(concurrency: number | null): { concurrency: number } | null {
  return concurrency === null ? null : { concurrency }
}

export interface TaskTableItem extends UserTaskDTO {
  templateKind?: MyTemplateKind
  templateName: string
  windowNumbers: string
  status: TaskPlanStatus
}

export function isTaskWindowSelectionValid(
  templateKind: MyTemplateKind | undefined,
  selectedWindowCount: number,
): boolean {
  return templateKind !== 'script' || selectedWindowCount > 0
}

export function findLatestTaskLogForTask<
  T extends Pick<AgentTaskLogDTO, 'startedAt' | 'taskId'>,
>(logs: readonly T[], taskId: number): T | undefined {
  return logs.reduce<T | undefined>((latest, log) => {
    if (log.taskId !== taskId)
      return latest
    if (!latest)
      return log
    return Date.parse(log.startedAt) > Date.parse(latest.startedAt) ? log : latest
  }, undefined)
}

export function resolveActiveTaskLogId(
  task: Pick<UserTaskDTO, 'runtimeTaskLogId'>,
  activeLog?: Pick<AgentTaskLogDTO, 'id'>,
): string | undefined {
  return activeLog?.id ?? task.runtimeTaskLogId ?? undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getTaskErrorI18nKey(
  code: string | null | undefined,
  fallback: string,
): string {
  return code ? TASK_ERROR_I18N_KEYS[code] ?? fallback : fallback
}

export function formatTaskDateTime(value?: string | null): string {
  if (!value)
    return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return value

  const pad = (part: number) => String(part).padStart(2, '0')
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  ].join(' ')
}

export function getTaskActivityDetails(
  log: Pick<AgentTaskLogDTO, 'input'>,
): string {
  if (typeof log.input === 'string')
    return log.input.trim() || '-'
  if (log.input === null || log.input === undefined)
    return '-'

  try {
    return JSON.stringify(log.input) || '-'
  }
  catch {
    return '-'
  }
}

export function getTaskDurationMs(
  log: Pick<AgentTaskLogDTO, 'durationMs' | 'startedAt' | 'status'>,
  now = Date.now(),
): number | null {
  if (log.status === 'preparing' || log.status === 'running') {
    const startedAt = Date.parse(log.startedAt)
    return Number.isFinite(startedAt) ? Math.max(0, now - startedAt) : null
  }

  return typeof log.durationMs === 'number' && Number.isFinite(log.durationMs)
    ? Math.max(0, log.durationMs)
    : null
}

export function readUserTaskPage(response: unknown, fallbackMessage: string): UserTaskPage {
  if (!isRecord(response) || response.code !== 0 || !isRecord(response.data))
    throw new Error(isRecord(response) && typeof response.message === 'string' ? response.message : fallbackMessage)

  const { items, total, limit, offset } = response.data
  if (!Array.isArray(items) || typeof total !== 'number' || typeof limit !== 'number' || typeof offset !== 'number')
    throw new Error(fallbackMessage)

  return response.data as unknown as UserTaskPage
}

export function readTaskMutation<T>(response: unknown, fallbackMessage: string): T {
  if (!isRecord(response) || response.code !== 0)
    throw new Error(isRecord(response) && typeof response.message === 'string' ? response.message : fallbackMessage)

  return response.data as T
}

export function getTaskPlanStatus(task: Pick<UserTaskDTO, 'enabled' | 'planType'>): TaskPlanStatus {
  if (task.planType === 'manual')
    return 'manual'

  return task.enabled ? 'scheduled' : 'paused'
}

export function toUserTaskCreatePlanType(planType: TaskPlanType): UserTaskCreatePlanTypeEnum {
  return USER_TASK_CREATE_PLAN_TYPES[planType]
}

export function toUserTaskUpdatePlanType(planType: TaskPlanType): UserTaskUpdatePlanTypeEnum {
  return USER_TASK_UPDATE_PLAN_TYPES[planType]
}

export function getTaskDisplayStatus(
  planStatus: TaskPlanStatus,
  executionStatus?: AgentTaskLogStatus,
  runtimeStatus?: TaskRuntimeStatus,
): TaskDisplayStatus {
  if (executionStatus === 'preparing' || executionStatus === 'running')
    return executionStatus
  return runtimeStatus === 'running' ? 'running' : planStatus
}

export function buildTaskTemplateOptions(templates: UserTemplateDTO[]): TaskTemplateOption[] {
  return templates.map(template => ({
    kind: normalizeMyTemplateKind(template.templateType),
    label: template.name,
    value: template.id,
  }))
}

export function formatTaskWindowNumbers(
  windowIds: readonly string[],
  windowNumbersById: ReadonlyMap<string, string>,
): string {
  return windowIds
    .map(id => windowNumbersById.get(id))
    .filter((value): value is string => Boolean(value))
    .join(', ')
}

export function mapTaskTableItem(
  task: UserTaskDTO,
  templatesById: Map<number, UserTemplateDTO>,
  windowNumbersById: Map<string, string>,
  missingTemplateLabel: string,
): TaskTableItem {
  const template = templatesById.get(task.userTemplateId)

  return {
    ...task,
    templateKind: normalizeMyTemplateKind(template?.templateType),
    templateName: template?.name || missingTemplateLabel,
    windowNumbers: formatTaskWindowNumbers(task.windowIds, windowNumbersById),
    status: getTaskPlanStatus(task),
  }
}
