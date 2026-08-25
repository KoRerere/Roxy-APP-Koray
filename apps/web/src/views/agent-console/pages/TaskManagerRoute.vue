<script setup lang="ts">
import type { UserTaskCreate, UserTaskUpdate } from '@roxy/agent-api'
import type { Ref } from 'vue'
import type { AgentTaskLogDTO, AgentTaskLogStatus } from '../api'
import type { UserTemplateDTO } from '../my-templates'
import type {
  TaskDialogInitialValues,
  TaskDialogPayload,
  TaskDisplayStatus,
  TaskTableItem,
  TaskWindowOption,
  UserTaskDTO,
} from '../task-manager'
import type { TaskSchedulePlan } from '../task-schedule'
import { useConfirm } from 'primevue/useconfirm'
import { useDialog } from 'primevue/usedialog'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useSimpleLocale } from '/@/stores/locale'
import { useWorkspaceStore } from '/@/stores/workspace'
import AgentConsolePageLayout from '../components/AgentConsolePageLayout.vue'
import AgentSelect from '../components/form/AgentSelect.vue'
import AgentPopover from '../components/AgentPopover.vue'
import AgentTooltip from '../components/AgentTooltip.vue'
import TaskLogDetailDrawer from '../components/TaskLogDetailDrawer.vue'
import TaskStatusBadge from '../components/TaskStatusBadge.vue'
import TaskTableSkeleton from '../components/skeleton/TaskTableSkeleton.vue'
import CreateTaskDialog from '../components/dialog/CreateTaskDialog.vue'
import CreateTemplateDialog from '../components/dialog/CreateTemplateDialog.vue'
import TaskScheduleDialog from '../components/dialog/TaskScheduleDialog.vue'
import OverflowTooltip from '../components/OverflowTooltip.vue'
import { useAgentConsoleApi } from '../api'
import { useAgentChannelState } from '../composables/useAgentChannel'
import { useTemplateTaskExecution } from '../composables/useTemplateTaskExecution'
import { mapMyTemplateItem, readUserTemplatePage } from '../my-templates'
import {
  buildTaskMetadata,
  buildTaskTemplateOptions,
  findLatestTaskLogForTask,
  formatTaskDateTime,
  getTaskDisplayStatus,
  getTaskErrorI18nKey,
  mapTaskTableItem,
  readTaskConcurrency,
  readTaskMutation,
  readUserTaskPage,
  resolveActiveTaskLogId,
  toUserTaskCreatePlanType,
  toUserTaskUpdatePlanType,
} from '../task-manager'
import {
  fetchTaskWindowOptionsByDirIds,
  fetchTaskWindowOptionsPage,
  reformatTaskWindowOptions,
} from '../task-window-options'

type TaskView = 'activity' | 'tasks'

defineProps<{
  activeConversationId?: string
  routeTitle?: string | symbol
  thinking?: boolean
}>()

defineEmits<{
  send: []
}>()

const prompt = defineModel<string>('prompt', { required: true })
const PAGE_SIZE = 200
const ACTIVITY_DEFAULT_PAGE_SIZE = 10
const ACTIVITY_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const TASK_STATUS_REFRESH_INTERVAL_MS = 5_000

const tabs = computed(() => [
  { id: 'tasks' as const, label: $t('任务列表') },
  { id: 'activity' as const, label: $t('执行日志') },
])
const statusLabels = computed<Record<TaskDisplayStatus, string>>(() => ({
  manual: $t('未计划'),
  paused: $t('已暂停'),
  preparing: $t('准备中'),
  running: $t('执行中'),
  scheduled: $t('已计划'),
}))
const activityStatusLabels = computed<Record<AgentTaskLogStatus, string>>(() => ({
  preparing: $t('准备中'),
  failed: $t('失败'),
  interrupted: $t('已停止'),
  partial_failed: $t('部分失败'),
  running: $t('执行中'),
  skipped: $t('已跳过'),
  success: $t('成功'),
}))
const stoppingStatusLabel = computed(() => $t('停止中...').replace(/\.\.\.$/, ''))

const activeTab = ref<TaskView>('tasks')
const agentApi = useAgentConsoleApi()
const agentChannel = useAgentChannelState()
const localeStore = useSimpleLocale()
const workspaceStore = useWorkspaceStore()
const dialog = useDialog()
const confirm = useConfirm()
const taskManagerLocaleClass = computed(() => `task-manager-content--${localeStore.siteLocale}`)
const [showToast, onlyErrorToast] = useResponseToast()
const { executeTemplateTask } = useTemplateTaskExecution(prompt)
const tasks = ref<TaskTableItem[]>([])
const templates = ref<UserTemplateDTO[]>([])
const windows = ref<TaskWindowOption[]>([])
const activityWindows = ref<TaskWindowOption[]>([])
const total = ref(0)
const loading = ref(false)
const loadError = ref(false)
const activityPageFirst = ref(0)
const activityPageSize = ref(ACTIVITY_DEFAULT_PAGE_SIZE)
const activityLogTotal = computed(() => agentChannel.taskLogs.value.length)
const activityPageSizeOptions = computed(() => ACTIVITY_PAGE_SIZE_OPTIONS.map(count => ({
  label: $t('{count} 条/页', { count }),
  value: count,
})))
const activityLogs = computed(() => agentChannel.taskLogs.value.slice(
  activityPageFirst.value,
  activityPageFirst.value + activityPageSize.value,
))
const activityLoading = computed(() => !agentChannel.taskLogsReady.value && !agentChannel.lastError.value)
const activityLoadError = computed(() => !agentChannel.taskLogsReady.value && Boolean(agentChannel.lastError.value))
const startingTaskIds = ref(new Set<number>())
const stoppingLogIds = ref(new Set<string>())
const deletingLogIds = ref(new Set<string>())
const selectedActivityLogId = ref<string>()
const activeActionTask = ref<TaskTableItem>()
const actionMenuOpen = ref(false)
const activeActivityLog = ref<AgentTaskLogDTO>()
const activityActionMenuOpen = ref(false)
const taskTableScrollRef = ref<HTMLElement | null>(null)
const activityTableScrollRef = ref<HTMLElement | null>(null)
const taskActionColumnOverlapping = ref(false)
const activityActionColumnOverlapping = ref(false)
let requestSequence = 0
let taskStatusRefreshTimer: ReturnType<typeof setTimeout> | undefined
let tableScrollResizeObserver: ResizeObserver | undefined
let previousTaskLogStatuses = new Map<string, AgentTaskLogStatus>()
let taskReferencesReady = false
let taskStatusRefreshStarted = false
let taskManagerMounted = false
const pendingTaskWindowLookups = new Map<string, Promise<void>>()
const pendingActivityWindowLookups = new Map<string, Promise<void>>()
const deletedTaskWindowIds = ref(new Set<string>())
const deletedActivityWindowIds = ref(new Set<string>())

const templateOptions = computed(() => buildTaskTemplateOptions(templates.value))
const windowOptions = computed(() => windows.value)
const activityWindowOptions = computed(() => activityWindows.value)
const windowNumbersById = computed(() => new Map(windowOptions.value.map(item => [item.id, item.code])))
const activityWindowNumbersById = computed(() => new Map(activityWindowOptions.value.map(item => [item.id, item.code])))
const activityWindowLabels = computed(() => Object.fromEntries(activityWindowNumbersById.value))
const deletedActivityWindowLabels = computed<Record<string, boolean>>(() => Object.fromEntries(
  Array.from(deletedActivityWindowIds.value).map(id => [id, true]),
))
const selectedActivityLog = computed(() => agentChannel.taskLogs.value
  .find(log => log.id === selectedActivityLogId.value))
const selectedActivityDetail = computed(() => selectedActivityLogId.value
  ? agentChannel.taskExecutionDetails.value[selectedActivityLogId.value]
  : undefined)
const selectedActivityWindowIds = computed(() => {
  const log = selectedActivityLog.value
  if (!log) {
    return []
  }

  const detailWindowIds = selectedActivityDetail.value?.scriptWindows
    .map(item => item.dirId)
    .filter((id): id is string => Boolean(id)) ?? []
  return getUniqueWindowIds([log.windowDirIds, detailWindowIds])
})
const selectedActivityWindowLabelsReady = computed(() => activityWindowOptionsReady(selectedActivityWindowIds.value))
const canCreateTask = computed(() => !loading.value && templateOptions.value.length > 0)

function onActivityPageSizeChange() {
  activityPageFirst.value = 0
}

watch(
  [activityLogTotal, activityPageSize],
  ([totalRecords, rows]) => {
    const lastPageFirst = totalRecords > 0
      ? Math.floor((totalRecords - 1) / rows) * rows
      : 0
    if (activityPageFirst.value > lastPageFirst) {
      activityPageFirst.value = lastPageFirst
    }
  },
)

function stickyActionColumnOverlaps(element: HTMLElement | null) {
  if (!element) {
    return false
  }
  const maxScrollLeft = element.scrollWidth - element.clientWidth
  return maxScrollLeft > 1 && element.scrollLeft < maxScrollLeft - 1
}

function syncStickyActionColumnBoundaries() {
  taskActionColumnOverlapping.value = stickyActionColumnOverlaps(taskTableScrollRef.value)
  activityActionColumnOverlapping.value = stickyActionColumnOverlaps(activityTableScrollRef.value)
}

function onTaskTableScroll() {
  taskActionColumnOverlapping.value = stickyActionColumnOverlaps(taskTableScrollRef.value)
}

function onActivityTableScroll() {
  activityActionColumnOverlapping.value = stickyActionColumnOverlaps(activityTableScrollRef.value)
}

watch(
  () => [taskTableScrollRef.value, activityTableScrollRef.value] as const,
  (elements, previousElements) => {
    previousElements?.forEach((element) => {
      if (element) {
        tableScrollResizeObserver?.unobserve(element)
      }
    })
    elements.forEach((element) => {
      if (element) {
        tableScrollResizeObserver?.observe(element)
      }
    })
    void nextTick(syncStickyActionColumnBoundaries)
  },
  { flush: 'post' },
)

watch(
  [tasks, activityLogs, activeTab],
  () => void nextTick(syncStickyActionColumnBoundaries),
  { flush: 'post' },
)

async function fetchAllTasks() {
  const rows: UserTaskDTO[] = []
  let offset = 0
  let expectedTotal = 0

  do {
    const response = await agentApi.userTasks.listUserTasks({
      limit: PAGE_SIZE,
      offset,
      sortBy: 'created_at',
      sortOrder: 'desc',
    })
    const page = readUserTaskPage(response, $t('加载任务失败'))
    rows.push(...page.items)
    expectedTotal = page.total
    offset += page.items.length
    if (!page.items.length) {
      break
    }
  } while (offset < expectedTotal)

  return { rows, total: expectedTotal }
}

async function fetchAllTemplates() {
  const rows: UserTemplateDTO[] = []
  let offset = 0
  let expectedTotal = 0

  do {
    const response = await agentApi.userTemplates.listUserTemplates({
      limit: PAGE_SIZE,
      offset,
      sortBy: 'name',
      sortOrder: 'asc',
    })
    const page = readUserTemplatePage(response, $t('加载任务模板失败'))
    rows.push(...page.items)
    expectedTotal = page.total
    offset += page.items.length
    if (!page.items.length) {
      break
    }
  } while (offset < expectedTotal)

  return rows
}

function currentWorkspaceName() {
  return workspaceStore.currentWorkspace?.workspaceName
}

function mergeWindowOptions(target: Ref<TaskWindowOption[]>, options: readonly TaskWindowOption[]) {
  if (options.length === 0) {
    return
  }

  const byId = new Map(target.value.map(item => [item.id, item]))
  options.forEach(item => byId.set(item.id, item))
  target.value = reformatTaskWindowOptions(Array.from(byId.values()), currentWorkspaceName())
}

function mergeTaskWindowOptions(options: readonly TaskWindowOption[]) {
  mergeWindowOptions(windows, options)
}

function mergeActivityWindowOptions(options: readonly TaskWindowOption[]) {
  mergeWindowOptions(activityWindows, options)
}

function getUniqueWindowIds(windowIdLists: readonly (readonly string[] | null | undefined)[]) {
  return Array.from(new Set(windowIdLists.flatMap(windowIds => windowIds ?? []).filter(Boolean)))
}

function updateDeletedWindowIds(
  target: Ref<Set<string>>,
  deletedIds: readonly string[],
  restoredIds: readonly string[] = [],
) {
  if (deletedIds.length === 0 && restoredIds.length === 0) {
    return
  }

  const next = new Set(target.value)
  deletedIds.forEach(id => next.add(id))
  restoredIds.forEach(id => next.delete(id))
  target.value = next
}

function isWindowReferenceResolved(
  id: string,
  labelsById: ReadonlyMap<string, string>,
  deletedIds: ReadonlySet<string>,
) {
  return labelsById.has(id) || deletedIds.has(id)
}

interface WindowLookupScope {
  options: Ref<TaskWindowOption[]>
  deletedIds: Ref<Set<string>>
  pendingLookups: Map<string, Promise<void>>
  mergeOptions: (options: readonly TaskWindowOption[]) => void
}

async function ensureWindowOptions(requestedIds: readonly string[], scope: WindowLookupScope) {
  const uniqueRequestedIds = Array.from(new Set(requestedIds.filter(Boolean)))
  if (uniqueRequestedIds.length === 0) {
    return
  }

  const loadedIds = new Set(scope.options.value.map(item => item.id))
  const pendingRequests: Promise<void>[] = []
  const missingIds: string[] = []
  for (const id of uniqueRequestedIds) {
    if (loadedIds.has(id) || scope.deletedIds.value.has(id)) {
      continue
    }

    const pending = scope.pendingLookups.get(id)
    if (pending) {
      pendingRequests.push(pending)
    }
    else {
      missingIds.push(id)
    }
  }

  if (missingIds.length > 0) {
    const request = (async () => {
      try {
        const options = await fetchTaskWindowOptionsByDirIds(missingIds, currentWorkspaceName())
        scope.mergeOptions(options)

        const foundIds = new Set(options.map(item => item.id))
        updateDeletedWindowIds(
          scope.deletedIds,
          missingIds.filter(id => !foundIds.has(id)),
          Array.from(foundIds),
        )
      }
      catch (error) {
        console.warn('Failed to load referenced task windows', error)
      }
      finally {
        missingIds.forEach((id) => {
          scope.pendingLookups.delete(id)
        })
      }
    })()
    missingIds.forEach(id => scope.pendingLookups.set(id, request))
    pendingRequests.push(request)
  }

  if (pendingRequests.length > 0) {
    await Promise.allSettled(Array.from(new Set(pendingRequests)))
  }
}

function ensureTaskWindowOptions(taskRows: readonly UserTaskDTO[]) {
  return ensureWindowOptions(getUniqueWindowIds(taskRows.map(task => task.windowIds)), {
    options: windows,
    deletedIds: deletedTaskWindowIds,
    pendingLookups: pendingTaskWindowLookups,
    mergeOptions: mergeTaskWindowOptions,
  })
}

function activityWindowOptionsReady(requestedIds: readonly string[]) {
  return requestedIds.every(id => isWindowReferenceResolved(
    id,
    activityWindowNumbersById.value,
    deletedActivityWindowIds.value,
  ))
}

function ensureActivityWindowIds(windowIds: readonly string[]) {
  return ensureWindowOptions(windowIds, {
    options: activityWindows,
    deletedIds: deletedActivityWindowIds,
    pendingLookups: pendingActivityWindowLookups,
    mergeOptions: mergeActivityWindowOptions,
  })
}

function ensureActivityWindowOptions(logs: readonly AgentTaskLogDTO[]) {
  return ensureActivityWindowIds(getUniqueWindowIds(logs.map(log => log.windowDirIds)))
}

function buildTaskRows(taskRows: UserTaskDTO[], templateRows: UserTemplateDTO[], windowRows: TaskWindowOption[]) {
  const templatesById = new Map(templateRows.map(template => [template.id, template]))
  const windowNumbersById = new Map(windowRows.map(item => [item.id, item.code]))
  return taskRows.map(task => mapTaskTableItem(
    task,
    templatesById,
    windowNumbersById,
    $t('模板不可用'),
  ))
}

async function loadTasks(): Promise<boolean> {
  const currentRequest = ++requestSequence
  loading.value = true
  loadError.value = false

  try {
    const [taskPage, templateRows] = await Promise.all([
      fetchAllTasks(),
      fetchAllTemplates(),
    ])
    if (currentRequest !== requestSequence) {
      return false
    }

    templates.value = templateRows
    tasks.value = buildTaskRows(taskPage.rows, templateRows, windowOptions.value)
    total.value = taskPage.total
    taskReferencesReady = true
    void ensureTaskWindowOptions(taskPage.rows)
    return true
  }
  catch (error) {
    if (currentRequest !== requestSequence) {
      return false
    }
    console.error('Failed to load user tasks', error)
    tasks.value = []
    total.value = 0
    loadError.value = true
    return false
  }
  finally {
    if (currentRequest === requestSequence) {
      loading.value = false
    }
  }
}

function formatSchedule(task: TaskTableItem) {
  if (task.planType === 'manual') {
    return $t('手动执行')
  }

  if (task.planType === 'once') {
    const value = task.nextExecuteAt ?? task.executeAt
    if (!value) {
      return $t('单次执行')
    }
    const executeAt = new Date(value)
    if (Number.isNaN(executeAt.getTime())) {
      return value
    }
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(executeAt)
  }

  if (!task.cron) {
    return '-'
  }

  const fields = task.cron.trim().split(/\s+/)
  if (fields.length !== 5) {
    return task.cron
  }
  const [minute, hour, day, month, week] = fields
  const nextExecuteAt = new Date(task.nextExecuteAt ?? '')
  const hasNextExecuteAt = !Number.isNaN(nextExecuteAt.getTime())
  const time = hasNextExecuteAt
    ? new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(nextExecuteAt)
    : `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`

  if (day === '*' && month === '*' && week === '*') {
    return $t('每天 {time}', { time })
  }
  if (day === '*' && month === '*' && week !== '*') {
    const weekday = hasNextExecuteAt
      ? new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(nextExecuteAt)
      : week
    return $t('每周 {weekday} {time}', { weekday, time })
  }
  if (day !== '*' && month === '*' && week === '*') {
    const monthlyDay = hasNextExecuteAt ? nextExecuteAt.getDate() : day
    return $t('每月 {day} 日 {time}', { day: monthlyDay, time })
  }
  return task.cron
}

function isActiveTaskLog(status: AgentTaskLogStatus) {
  return status === 'preparing' || status === 'running'
}

const activeTaskLogByTaskId = computed(() => {
  const logs = agentChannel.taskLogs.value.filter(log => isActiveTaskLog(log.status))
  return new Map(logs.map(log => [log.taskId, log]))
})

function taskDisplayStatus(task: TaskTableItem): TaskDisplayStatus {
  return getTaskDisplayStatus(
    task.status,
    activeTaskLogByTaskId.value.get(task.id)?.status,
    task.runtimeStatus,
  )
}

function isManualTask(task: TaskTableItem) {
  return taskDisplayStatus(task) === 'manual'
}

function isTaskRunning(task: TaskTableItem) {
  const status = taskDisplayStatus(task)
  return status === 'preparing' || status === 'running'
}

function taskActiveLogId(task: TaskTableItem) {
  return resolveActiveTaskLogId(task, activeTaskLogByTaskId.value.get(task.id))
}

function isTaskStopping(task: TaskTableItem) {
  const logId = taskActiveLogId(task)
  return Boolean(logId && stoppingLogIds.value.has(logId))
}

function formatWindowIds(
  windowIds: readonly string[],
  labelsById: ReadonlyMap<string, string>,
  deletedIds: ReadonlySet<string>,
) {
  if (windowIds.length === 0) {
    return '-'
  }

  if (!windowIds.every(id => isWindowReferenceResolved(id, labelsById, deletedIds))) {
    return $t('加载中...')
  }

  const labels = windowIds
    .map(id => labelsById.get(id))
    .filter((label): label is string => Boolean(label))
  return labels.length > 0
    ? labels.join('、')
    : $t('窗口已删除')
}

function formatTaskWindows(task: Pick<UserTaskDTO, 'windowIds'>) {
  return formatWindowIds(task.windowIds, windowNumbersById.value, deletedTaskWindowIds.value)
}

function formatActivityWindows(log: AgentTaskLogDTO) {
  return formatWindowIds(log.windowDirIds, activityWindowNumbersById.value, deletedActivityWindowIds.value)
}

function activityEndReason(log: AgentTaskLogDTO) {
  return log.endReasonCode
    ? $t(getTaskErrorI18nKey(log.endReasonCode, '任务执行失败，请稍后重试'))
    : ''
}

function openActivityLogDetail(log: AgentTaskLogDTO) {
  selectedActivityLogId.value = log.id
  void ensureActivityWindowOptions([log])
}

function closeActivityLogDetail() {
  selectedActivityLogId.value = undefined
}

function openTaskActivityLog(task: TaskTableItem) {
  closeTaskActionMenu()
  activeTab.value = 'activity'
  const log = findLatestTaskLogForTask(agentChannel.taskLogs.value, task.id)
  selectedActivityLogId.value = log?.id
  if (log) {
    void ensureActivityWindowOptions([log])
  }
  const logIndex = log
    ? agentChannel.taskLogs.value.findIndex(item => item.id === log.id)
    : -1
  if (logIndex >= 0) {
    activityPageFirst.value = Math.floor(logIndex / activityPageSize.value) * activityPageSize.value
  }
}

function taskInitialValues(task: TaskTableItem): TaskDialogInitialValues {
  return {
    id: task.id,
    name: task.name,
    userTemplateId: task.userTemplateId,
    windowIds: [...task.windowIds],
    planType: task.planType,
    cron: task.cron ?? null,
    timezone: task.timezone ?? null,
    executeAt: task.executeAt ?? null,
    nextExecuteAt: task.nextExecuteAt ?? null,
    enabled: task.enabled,
    concurrency: readTaskConcurrency(task.metadata),
  }
}

async function saveTask(payload: TaskDialogPayload, task?: TaskTableItem) {
  try {
    if (task) {
      const body: UserTaskUpdate = {
        name: payload.name,
        window_ids: payload.windowIds,
        plan_type: toUserTaskUpdatePlanType(payload.planType),
        cron: payload.cron,
        timezone: payload.timezone,
        execute_at: payload.executeAt,
        enabled: payload.enabled,
        metadata: buildTaskMetadata(payload.concurrency),
      }
      const response = await agentApi.userTasks.updateUserTask({ taskId: task.id }, body)
      readTaskMutation<UserTaskDTO>(response, $t('保存任务失败'))
      showToast(0, $t('任务已更新'))
    }
    else {
      const body: UserTaskCreate = {
        name: payload.name,
        user_template_id: payload.userTemplateId,
        window_ids: payload.windowIds,
        plan_type: toUserTaskCreatePlanType(payload.planType),
        cron: payload.cron,
        timezone: payload.timezone,
        execute_at: payload.executeAt,
        enabled: payload.enabled,
        metadata: buildTaskMetadata(payload.concurrency),
      }
      const response = await agentApi.userTasks.createUserTask(body)
      readTaskMutation<UserTaskDTO>(response, $t('创建任务失败'))
    }
    await syncLocalTasks()
    await refreshTaskStatuses()
    return true
  }
  catch (error) {
    console.error('Failed to save user task', error)
    onlyErrorToast(-1, error instanceof Error ? error.message : $t('保存任务失败'))
    return false
  }
}

function openTaskDialog(task?: TaskTableItem) {
  if (!task && !canCreateTask.value) {
    onlyErrorToast(-1, $t('请先创建一个用户模板'))
    return
  }

  const workspaceName = currentWorkspaceName()
  const selectedWindowOptions = task
    ? windowOptions.value.filter(option => task.windowIds.includes(option.id))
    : []

  dialog.open(CreateTaskDialog, {
    props: {
      modal: true,
      blockScroll: true,
      dismissableMask: false,
      draggable: false,
      showHeader: false,
      style: { width: 'min(440px, calc(100vw - 32px))' },
      pt: {
        root: 'agent-console-dialog agent-console-create-task-dialog',
        content: '!p-0 !overflow-hidden',
      },
    },
    data: {
      initialValues: task ? taskInitialValues(task) : undefined,
      templateOptions: templateOptions.value,
      windowOptions: selectedWindowOptions,
      loadWindowOptions: (pageIndex: number, keyword: string, projectId: string) => fetchTaskWindowOptionsPage({
        pageIndex,
        pageSize: 10,
        keyword,
        projectId,
      }, workspaceName),
      onSave: (payload: TaskDialogPayload) => saveTask(payload, task),
    },
  })
}

async function saveTaskSchedule(task: TaskTableItem, payload: TaskSchedulePlan) {
  try {
    const body: UserTaskUpdate = {
      plan_type: toUserTaskUpdatePlanType(payload.planType),
      cron: payload.cron,
      timezone: payload.timezone,
      execute_at: payload.executeAt,
      enabled: payload.enabled,
    }
    const response = await agentApi.userTasks.updateUserTask({ taskId: task.id }, body)
    readTaskMutation<UserTaskDTO>(response, $t('保存计划失败'))
    showToast(0, $t('计划已更新'))
    await syncLocalTasks()
    await refreshTaskStatuses()
    return true
  }
  catch (error) {
    console.error('Failed to save task schedule', error)
    onlyErrorToast(-1, error instanceof Error ? error.message : $t('保存计划失败'))
    return false
  }
}

function openTaskScheduleDialog(task: TaskTableItem) {
  closeTaskActionMenu()
  dialog.open(TaskScheduleDialog, {
    props: {
      modal: true,
      blockScroll: true,
      dismissableMask: false,
      draggable: false,
      showHeader: false,
      style: { width: 'min(440px, calc(100vw - 32px))' },
      pt: {
        root: 'agent-console-dialog agent-console-task-schedule-dialog',
        content: '!p-0 !overflow-hidden',
      },
    },
    data: {
      initialValues: {
        planType: task.planType,
        cron: task.cron,
        executeAt: task.executeAt,
        nextExecuteAt: task.nextExecuteAt,
        enabled: task.enabled,
      },
      onSave: (payload: TaskSchedulePlan) => saveTaskSchedule(task, payload),
    },
  })
}

async function toggleTaskPlan(task: TaskTableItem) {
  closeTaskActionMenu()
  try {
    const response = await agentApi.userTasks.updateUserTask(
      { taskId: task.id },
      { enabled: !task.enabled },
    )
    readTaskMutation<UserTaskDTO>(response, $t('更新计划状态失败'))
    showToast(0, task.enabled ? $t('计划已暂停') : $t('计划已启用'))
    await syncLocalTasks()
    await refreshTaskStatuses()
  }
  catch (error) {
    console.error('Failed to toggle task plan', error)
    onlyErrorToast(-1, error instanceof Error ? error.message : $t('更新计划状态失败'))
  }
}

function deleteTask(task: TaskTableItem) {
  closeTaskActionMenu()
  confirm.require({
    group: 'agentConsoleDeleteConfirmDialog',
    header: $t('删除任务'),
    message: $t('删除后无法恢复，确认删除任务“{name}”吗？', { name: task.name }),
    acceptLabel: $t('删除'),
    rejectLabel: $t('取消'),
    accept: async () => {
      try {
        const response = await agentApi.userTasks.deleteUserTask({ taskId: task.id })
        readTaskMutation<unknown>(response, $t('删除任务失败'))
        await syncLocalTasks()
        await refreshTaskStatuses()
      }
      catch (error) {
        console.error('Failed to delete user task', error)
        onlyErrorToast(-1, error instanceof Error ? error.message : $t('删除任务失败'))
      }
    },
  })
}

function isTaskActionMenuOpen(task: TaskTableItem) {
  return actionMenuOpen.value && activeActionTask.value?.id === task.id
}

function onTaskActionMenuOpenChange(open: boolean, task: TaskTableItem) {
  actionMenuOpen.value = open
  activeActionTask.value = open ? task : undefined
}

function closeTaskActionMenu() {
  actionMenuOpen.value = false
  activeActionTask.value = undefined
}

function isActivityActionMenuOpen(log: AgentTaskLogDTO) {
  return activityActionMenuOpen.value && activeActivityLog.value?.id === log.id
}

function onActivityActionMenuOpenChange(open: boolean, log: AgentTaskLogDTO) {
  activityActionMenuOpen.value = open
  activeActivityLog.value = open ? log : undefined
}

function closeActivityActionMenu() {
  activityActionMenuOpen.value = false
  activeActivityLog.value = undefined
}

async function syncLocalTasks() {
  try {
    await agentApi.syncTasks()
  }
  catch (error) {
    console.warn('Failed to sync local task scheduler', error)
    onlyErrorToast(-1, $t('任务已保存，本地计划同步失败，将自动重试'))
  }
}

function setTaskStarting(taskId: number, starting: boolean) {
  const next = new Set(startingTaskIds.value)
  if (starting) {
    next.add(taskId)
  }
  else {
    next.delete(taskId)
  }
  startingTaskIds.value = next
}

async function refreshTaskStatuses(silent = true) {
  if (!taskReferencesReady) {
    return
  }

  const currentRequest = ++requestSequence
  if (!silent) {
    loading.value = true
    loadError.value = false
  }

  try {
    const taskPage = await fetchAllTasks()
    if (currentRequest !== requestSequence) {
      return
    }
    tasks.value = buildTaskRows(taskPage.rows, templates.value, windowOptions.value)
    void ensureTaskWindowOptions(taskPage.rows)
    clearFinishedStoppingLogIds()
    total.value = taskPage.total
    loadError.value = false
  }
  catch (error) {
    if (currentRequest !== requestSequence) {
      return
    }
    console.error('Failed to refresh user task statuses', error)
    if (!silent) {
      loadError.value = true
    }
  }
  finally {
    if (!silent && currentRequest === requestSequence) {
      loading.value = false
    }
  }
}

async function runTaskNow(task: TaskTableItem) {
  if (startingTaskIds.value.has(task.id) || isTaskRunning(task)) {
    return
  }
  setTaskStarting(task.id, true)
  try {
    const template = templates.value.find(item => item.id === task.userTemplateId)
    if (!template) {
      onlyErrorToast(-1, $t('任务模板不存在或不可用'))
      return
    }
    await executeTemplateTask(task, template)
  }
  finally {
    setTaskStarting(task.id, false)
  }
}

function openTemplatePreview(task: TaskTableItem) {
  const template = templates.value.find(item => item.id === task.userTemplateId)
  const myTemplate = template ? mapMyTemplateItem(template) : undefined
  if (!template || !myTemplate) {
    onlyErrorToast(-1, $t('任务模板不存在或不可用'))
    return
  }
  dialog.open(CreateTemplateDialog, {
    props: {
      modal: true,
      blockScroll: true,
      dismissableMask: false,
      draggable: false,
      showHeader: false,
      style: { width: 'min(540px, calc(100vw - 32px))' },
      pt: {
        root: 'agent-console-dialog agent-console-create-template-dialog',
        content: '!p-0 !overflow-hidden',
      },
    },
    data: {
      template: myTemplate,
      loadDetail: true,
      readonly: true,
    },
  })
}

function stopTaskStatusRefresh() {
  if (taskStatusRefreshTimer) {
    clearTimeout(taskStatusRefreshTimer)
  }
  taskStatusRefreshTimer = undefined
}

function scheduleTaskStatusRefresh() {
  stopTaskStatusRefresh()
  if (document.visibilityState !== 'visible') {
    return
  }
  taskStatusRefreshTimer = setTimeout(async () => {
    await refreshTaskStatuses()
    scheduleTaskStatusRefresh()
  }, TASK_STATUS_REFRESH_INTERVAL_MS)
}

function startTaskStatusRefresh() {
  if (!taskManagerMounted || taskStatusRefreshStarted) {
    return
  }
  taskStatusRefreshStarted = true
  window.addEventListener('focus', refreshVisibleTaskStatuses)
  document.addEventListener('visibilitychange', refreshVisibleTaskStatuses)
  scheduleTaskStatusRefresh()
}

async function retryLoadTasks() {
  if (await loadTasks()) {
    startTaskStatusRefresh()
  }
}

function refreshVisibleTaskStatuses() {
  if (document.visibilityState !== 'visible') {
    stopTaskStatusRefresh()
    return
  }
  void refreshTaskStatuses().finally(scheduleTaskStatusRefresh)
}

watch(
  activityLogs,
  logs => void ensureActivityWindowOptions(logs),
  { immediate: true },
)

watch(
  selectedActivityWindowIds,
  ids => void ensureActivityWindowIds(ids),
  { immediate: true },
)

watch(
  agentChannel.taskLogs,
  (logs) => {
    const nextStatuses = new Map(logs.map(log => [log.id, log.status]))
    const finishedLocally = logs.some((log) => {
      const previous = previousTaskLogStatuses.get(log.id)
      return previous !== undefined && isActiveTaskLog(previous) && !isActiveTaskLog(log.status)
    })

    previousTaskLogStatuses = nextStatuses
    if (finishedLocally && taskReferencesReady) {
      void refreshTaskStatuses()
    }
  },
  { immediate: true },
)

function setPendingLogId(target: { value: Set<string> }, logId: string, pending: boolean) {
  const next = new Set(target.value)
  if (pending) {
    next.add(logId)
  }
  else {
    next.delete(logId)
  }
  target.value = next
}

function clearFinishedStoppingLogIds() {
  if (stoppingLogIds.value.size === 0) {
    return
  }

  const taskById = new Map(tasks.value.map(task => [task.id, task]))
  const finishedLogIds = agentChannel.taskLogs.value
    .filter((log) => {
      if (!stoppingLogIds.value.has(log.id) || isActiveTaskLog(log.status)) {
        return false
      }

      const task = taskById.get(log.taskId)
      return !task || !isTaskRunning(task)
    })
    .map(log => log.id)

  if (finishedLogIds.length === 0) {
    return
  }

  const nextStoppingLogIds = new Set(stoppingLogIds.value)
  finishedLogIds.forEach(logId => nextStoppingLogIds.delete(logId))
  stoppingLogIds.value = nextStoppingLogIds
}

async function stopTask(task: TaskTableItem) {
  if (!isTaskRunning(task)) {
    return
  }

  const logId = taskActiveLogId(task)
  if (!logId) {
    onlyErrorToast(-1, $t('停止任务失败'))
    return
  }
  if (stoppingLogIds.value.has(logId)) {
    return
  }

  setPendingLogId(stoppingLogIds, logId, true)
  try {
    await agentApi.stopTaskLog(logId)
    showToast(0, $t('停止请求已发送'))
    await refreshTaskStatuses()
  }
  catch (error) {
    setPendingLogId(stoppingLogIds, logId, false)
    console.error('Failed to stop task', error)
    onlyErrorToast(-1, error instanceof Error ? error.message : $t('停止任务失败'))
  }
}

async function stopActivityLog(log: AgentTaskLogDTO) {
  closeActivityActionMenu()
  if (!isActiveTaskLog(log.status) || stoppingLogIds.value.has(log.id)) {
    return
  }

  setPendingLogId(stoppingLogIds, log.id, true)
  try {
    await agentApi.stopTaskLog(log.id)
    showToast(0, $t('停止请求已发送'))
  }
  catch (error) {
    setPendingLogId(stoppingLogIds, log.id, false)
    console.error('Failed to stop task log', error)
    onlyErrorToast(-1, error instanceof Error ? error.message : $t('停止任务失败'))
  }
}

function deleteActivityLog(log: AgentTaskLogDTO) {
  closeActivityActionMenu()
  if (isActiveTaskLog(log.status) || deletingLogIds.value.has(log.id)) {
    return
  }

  confirm.require({
    group: 'agentConsoleDeleteConfirmDialog',
    header: $t('删除记录'),
    message: $t('删除后无法恢复，确认删除任务“{name}”的这条执行记录吗？', { name: log.taskName }),
    acceptLabel: $t('删除'),
    rejectLabel: $t('取消'),
    accept: async () => {
      setPendingLogId(deletingLogIds, log.id, true)
      try {
        await agentApi.deleteTaskLog(log.id)
        showToast(0, $t('执行记录已删除'))
      }
      catch (error) {
        console.error('Failed to delete task log', error)
        onlyErrorToast(-1, error instanceof Error ? error.message : $t('删除执行记录失败'))
      }
      finally {
        setPendingLogId(deletingLogIds, log.id, false)
      }
    },
  })
}

onMounted(() => {
  taskManagerMounted = true
  tableScrollResizeObserver = new ResizeObserver(syncStickyActionColumnBoundaries)
  for (const element of [taskTableScrollRef.value, activityTableScrollRef.value]) {
    if (element) {
      tableScrollResizeObserver.observe(element)
    }
  }
  syncStickyActionColumnBoundaries()
  void loadTasks().then((ready) => {
    if (ready) {
      startTaskStatusRefresh()
    }
  })
})

onBeforeUnmount(() => {
  taskManagerMounted = false
  tableScrollResizeObserver?.disconnect()
  tableScrollResizeObserver = undefined
  requestSequence++
  stopTaskStatusRefresh()
  window.removeEventListener('focus', refreshVisibleTaskStatuses)
  document.removeEventListener('visibilitychange', refreshVisibleTaskStatuses)
})
</script>

<template>
  <AgentConsolePageLayout
    overflow="auto"
    padding="56px 20px 40px"
    mobile-padding="56px 16px 32px"
    :title="$t('任务管理')"
  >
    <div class="task-manager-content" :class="taskManagerLocaleClass">
      <h1>{{ $t('任务管理') }}</h1>

      <div class="task-tabs" role="tablist" :aria-label="$t('任务管理视图')">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="task-tab"
          :class="{ active: activeTab === tab.id }"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.id"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <div v-if="activeTab === 'tasks'" class="task-list-toolbar">
        <Skeleton v-if="loading && !tasks.length" width="96px" height="20px" border-radius="4px" />
        <p v-else>
          {{ $t('共 {count} 个任务', { count: total }) }}
        </p>
        <AgentTooltip
          :content="$t('请先创建一个用户模板')"
          :disabled="canCreateTask"
        >
          <button class="new-task-button" type="button" :disabled="!canCreateTask" @click="openTaskDialog()">
            <SvgIcon name="base/rx_ic_plus" size="18" aria-hidden="true" />
            <span>{{ $t('创建任务') }}</span>
          </button>
        </AgentTooltip>
      </div>

      <div v-if="activeTab === 'tasks'" class="task-view">
        <TaskTableSkeleton v-if="loading && !tasks.length" variant="tasks" :rows="5" />

        <div v-else-if="loadError && !tasks.length" class="task-state">
          <SvgIcon name="roxy-agent/rx-ic-task-manager" size="32" />
          <strong>{{ $t('任务加载失败') }}</strong>
          <span>{{ $t('请检查网络连接后重试。') }}</span>
          <button class="state-action" type="button" @click="retryLoadTasks">
            {{ $t('重试') }}
          </button>
        </div>

        <div
          v-else-if="tasks.length"
          ref="taskTableScrollRef"
          class="task-table-scroll"
          :class="{ 'task-table-scroll--sticky-overlap': taskActionColumnOverlapping }"
          @scroll.passive="onTaskTableScroll"
        >
          <table class="task-table">
            <colgroup>
              <col class="col-task">
              <col class="col-template">
              <col class="col-windows">
              <col class="col-created">
              <col class="col-schedule">
              <col class="col-status">
              <col class="col-actions">
            </colgroup>
            <thead>
              <tr>
                <th scope="col">
                  {{ $t('任务名称') }}
                </th>
                <th scope="col">
                  {{ $t('任务模板') }}
                </th>
                <th scope="col">
                  {{ $t('关联窗口') }}
                </th>
                <th scope="col">
                  {{ $t('创建时间') }}
                </th>
                <th scope="col">
                  {{ $t('执行计划') }}
                </th>
                <th scope="col">
                  {{ $t('状态') }}
                </th>
                <th scope="col">
                  {{ $t('操作') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="task in tasks" :key="task.id">
                <td class="task-name-cell">
                  <OverflowTooltip :content="task.name" />
                </td>
                <td>
                  <button
                    type="button"
                    class="template-badge template-badge--link"
                    :disabled="!task.userTemplateId"
                    @click="openTemplatePreview(task)"
                  >
                    <span class="template-badge__name">{{ task.templateName }}</span>
                  </button>
                </td>
                <td><OverflowTooltip :content="formatTaskWindows(task)" /></td>
                <td>{{ formatTaskDateTime(task.createdAt) }}</td>
                <td><OverflowTooltip :content="formatSchedule(task)" /></td>
                <td>
                  <button
                    v-if="isManualTask(task)"
                    class="status-pill status-pill--add-plan"
                    type="button"
                    @click="openTaskScheduleDialog(task)"
                  >
                    <SvgIcon name="base/rx_ic_plus" size="14" aria-hidden="true" />
                    <span>{{ $t('添加计划') }}</span>
                  </button>
                  <span
                    v-else-if="taskDisplayStatus(task) === 'running' && !isTaskStopping(task)"
                    class="status-pill running"
                  >
                    <TaskStatusBadge status="running" />
                  </span>
                  <span
                    v-else
                    class="status-pill"
                    :class="isTaskStopping(task) ? 'stopping' : taskDisplayStatus(task)"
                  >
                    <span class="status-dot" aria-hidden="true" />
                    {{ isTaskStopping(task) ? stoppingStatusLabel : statusLabels[taskDisplayStatus(task)] }}
                  </span>
                </td>
                <td>
                  <div class="task-actions">
                    <button
                      v-if="isTaskRunning(task)"
                      class="stop-task-button"
                      type="button"
                      :disabled="isTaskStopping(task)"
                      @click="stopTask(task)"
                    >
                      {{ isTaskStopping(task) ? $t('停止中...') : $t('停止任务') }}
                    </button>
                    <button
                      v-else
                      class="run-button"
                      type="button"
                      :disabled="startingTaskIds.has(task.id)"
                      @click="runTaskNow(task)"
                    >
                      {{ startingTaskIds.has(task.id) ? $t('启动中...') : $t('立即执行') }}
                    </button>
                    <AgentPopover
                      :open="isTaskActionMenuOpen(task)"
                      content-class="task-action-popover task-list-action-popover"
                      placement="bottom-end"
                      :offset="6"
                      :z-index="80"
                      @update:open="onTaskActionMenuOpenChange($event, task)"
                    >
                      <button
                        class="icon-button"
                        type="button"
                        :aria-label="$t('更多任务操作：{name}', { name: task.name })"
                        :aria-expanded="isTaskActionMenuOpen(task)"
                      >
                        <SvgIcon name="base/rx_ic_more-v" size="16" />
                      </button>

                      <template #content>
                        <button type="button" @click="closeTaskActionMenu(); openTaskDialog(task)">
                          <SvgIcon name="base/rx_ic_agent_edit" size="16" />
                          <span>{{ $t('编辑') }}</span>
                        </button>
                        <button type="button" @click="openTaskActivityLog(task)">
                          <SvgIcon name="roxy-agent/rx-ic-task-logs" size="16" />
                          <span>{{ $t('查看日志') }}</span>
                        </button>
                        <button type="button" @click="openTaskScheduleDialog(task)">
                          <SvgIcon name="roxy-agent/rx-ic-task-schedule" size="16" />
                          <span>{{ $t('计划') }}</span>
                        </button>
                        <button v-if="task.planType !== 'manual'" type="button" @click="toggleTaskPlan(task)">
                          <SvgIcon :name="task.enabled ? 'roxy-agent/rx-ic-task-pause' : 'base/rx_ic_play'" size="16" />
                          <span>{{ task.enabled ? $t('暂停计划') : $t('启用计划') }}</span>
                        </button>
                        <button class="danger" type="button" @click="deleteTask(task)">
                          <SvgIcon name="base/rx_ic_bin_1" size="16" />
                          <span>{{ $t('删除') }}</span>
                        </button>
                      </template>
                    </AgentPopover>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="task-state">
          <SvgIcon name="roxy-agent/rx-ic-task-manager" size="32" />
          <strong>{{ $t('暂无任务') }}</strong>
          <span>{{ $t('创建任务后，可在此统一管理任务定义与执行计划。') }}</span>
        </div>
      </div>

      <TaskTableSkeleton
        v-else-if="activityLoading"
        variant="activity"
        :rows="ACTIVITY_DEFAULT_PAGE_SIZE"
      />

      <div v-else-if="activityLoadError" class="task-state">
        <SvgIcon name="roxy-agent/rx-ic-task-manager" size="32" />
        <strong>{{ $t('执行日志加载失败') }}</strong>
        <button class="state-action" type="button" @click="agentChannel.reconnect()">
          {{ $t('重试') }}
        </button>
      </div>

      <div v-else-if="activityLogTotal" class="activity-view">
        <div
          ref="activityTableScrollRef"
          class="task-table-scroll activity-table-scroll"
          :class="{ 'task-table-scroll--sticky-overlap': activityActionColumnOverlapping }"
          @scroll.passive="onActivityTableScroll"
        >
          <table class="task-table activity-table">
            <colgroup>
              <col class="col-activity-task">
              <col class="col-activity-template">
              <col class="col-activity-windows">
              <col class="col-activity-started">
              <col class="col-activity-ended">
              <col class="col-activity-status">
              <col class="col-activity-actions">
            </colgroup>
            <thead>
              <tr>
                <th scope="col">
                  {{ $t('任务') }}
                </th>
                <th scope="col">
                  {{ $t('模板') }}
                </th>
                <th scope="col">
                  {{ $t('窗口') }}
                </th>
                <th scope="col">
                  {{ $t('开始时间') }}
                </th>
                <th scope="col">
                  {{ $t('结束时间') }}
                </th>
                <th scope="col">
                  {{ $t('状态') }}
                </th>
                <th scope="col">
                  {{ $t('操作') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in activityLogs" :key="log.id">
                <td class="task-name-cell">
                  <OverflowTooltip :content="log.taskName" />
                </td>
                <td>
                  <div class="template-badge">
                    <OverflowTooltip :content="log.templateName" />
                  </div>
                </td>
                <td><OverflowTooltip :content="formatActivityWindows(log)" /></td>
                <td>{{ formatTaskDateTime(log.startedAt) }}</td>
                <td>{{ formatTaskDateTime(log.endedAt) }}</td>
                <td>
                  <span
                    class="activity-status"
                    :class="stoppingLogIds.has(log.id) ? 'stopping' : log.status"
                    :title="activityEndReason(log) || undefined"
                  >
                    <span class="status-dot" aria-hidden="true" />
                    <span class="activity-status-label">
                      {{ stoppingLogIds.has(log.id) ? stoppingStatusLabel : activityStatusLabels[log.status] }}
                    </span>
                  </span>
                </td>
                <td>
                  <div class="task-actions activity-actions">
                    <button class="view-logs-button" type="button" @click.stop="openActivityLogDetail(log)">
                      {{ $t('查看日志') }}
                    </button>
                    <AgentPopover
                      :open="isActivityActionMenuOpen(log)"
                      content-class="task-action-popover"
                      placement="bottom-end"
                      :offset="6"
                      :z-index="80"
                      @update:open="onActivityActionMenuOpenChange($event, log)"
                    >
                      <button
                        class="icon-button"
                        type="button"
                        :aria-label="$t('更多执行记录操作：{name}', { name: log.taskName })"
                        :aria-expanded="isActivityActionMenuOpen(log)"
                      >
                        <SvgIcon name="base/rx_ic_more-v" size="16" />
                      </button>

                      <template #content>
                        <button
                          v-if="isActiveTaskLog(log.status)"
                          type="button"
                          :disabled="stoppingLogIds.has(log.id)"
                          @click="stopActivityLog(log)"
                        >
                          <SvgIcon name="base/rx_ic_pause" size="16" />
                          <span>{{ stoppingLogIds.has(log.id) ? $t('停止中...') : $t('停止任务') }}</span>
                        </button>
                        <button
                          v-else
                          class="danger"
                          type="button"
                          :disabled="deletingLogIds.has(log.id)"
                          @click="deleteActivityLog(log)"
                        >
                          <SvgIcon name="base/rx_ic_bin_1" size="16" />
                          <span>{{ deletingLogIds.has(log.id) ? $t('删除中...') : $t('删除记录') }}</span>
                        </button>
                      </template>
                    </AgentPopover>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <Paginator
          v-model:first="activityPageFirst"
          class="activity-paginator"
          :rows="activityPageSize"
          :total-records="activityLogTotal"
          :page-link-size="5"
          template="JumpToPageInput PrevPageLink PageLinks NextPageLink"
        >
          <template #start>
            <div class="activity-paginator-start">
              <span class="activity-paginator-total">{{ $t('总计 {total} 个', { total: activityLogTotal }) }}</span>
              <AgentSelect
                v-model="activityPageSize"
                class="activity-page-size-select"
                name="activityRowsPerPage"
                :options="activityPageSizeOptions"
                @change="onActivityPageSizeChange"
              />
              <span class="activity-paginator-jump-label">{{ $t('跳转页数至') }}</span>
            </div>
          </template>
        </Paginator>
      </div>

      <div v-else class="task-state">
        <SvgIcon name="roxy-agent/rx-ic-task-manager" size="32" />
        <strong>{{ $t('暂无执行日志') }}</strong>
      </div>
    </div>
  </AgentConsolePageLayout>

  <Teleport to="body">
    <TaskLogDetailDrawer
      v-if="selectedActivityLog"
      :log="selectedActivityLog"
      :detail="selectedActivityDetail"
      :detail-ready="agentChannel.taskExecutionReady.value"
      :end-reason="activityEndReason(selectedActivityLog)"
      :window-labels="activityWindowLabels"
      :deleted-window-labels="deletedActivityWindowLabels"
      :window-labels-ready="selectedActivityWindowLabelsReady"
      :file-url="agentApi.getFileUrl"
      @close="closeActivityLogDetail"
    />
  </Teleport>
</template>

<style lang="scss" scoped>
.task-manager-content {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
}

h1 {
  margin: 0 0 12px;
  color: var(--color-text-primary);
  font-size: 24px;
  font-weight: 500;
  line-height: 32px;
}

.task-tabs {
  display: flex;
  height: 32px;
  align-items: center;
  gap: 4px;
  border-bottom: 1px solid var(--color-border-secondary);
}

.task-tab {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  border: 0;
  border-bottom: 2px solid transparent;
  color: var(--color-text-quaternary);
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;

  &.active {
    border-bottom-color: var(--color-text-primary);
    color: var(--color-text-primary);
  }
}

.task-list-toolbar {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 20px 0;

  p {
    margin: 0;
    color: var(--color-text-primary);
    font-size: 14px;
    line-height: 20px;
  }
}

.new-task-button,
.run-button,
.stop-task-button,
.icon-button,
.state-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  font-family: inherit;
  white-space: nowrap;
}

.new-task-button,
.run-button {
  height: 32px;
  border-radius: 10px;
  color: var(--color-bg-primary);
  background: var(--color-bg-primary-inverse);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.new-task-button:not(:disabled):hover,
.run-button:not(:disabled):hover {
  background: var(--color-bg-primary-inverse-hover);
}

.new-task-button {
  gap: 4px;
  padding: 6px 10px;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
}

.task-view,
.activity-view {
  min-width: 0;
}

.activity-view {
  margin-top: 20px;
}

.task-table-scroll {
  width: 100%;
  overflow-x: auto;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  scrollbar-width: thin;
}

.task-table {
  width: 100%;
  min-width: 760px;
  table-layout: fixed;
  border-collapse: collapse;
  color: var(--color-text-primary);
  font-size: 14px;
  line-height: 20px;

  th,
  td {
    height: 58px;
    padding: 8px;
    border-bottom: 1px solid var(--color-border-secondary);
    overflow: hidden;
    text-align: left;
    vertical-align: middle;
  }

  th {
    height: 40px;
    background: var(--color-bg-tertiary);
    font-weight: 500;
  }

  tbody tr:last-child td {
    border-bottom: 0;
  }

  th:last-child,
  td:last-child {
    position: sticky;
    right: 0;
    z-index: 2;
    background: var(--color-bg-primary);
  }

  th:last-child {
    z-index: 3;
    background: var(--color-bg-tertiary);
  }
}

.task-table-scroll--sticky-overlap {
  .task-table th:last-child,
  .task-table td:last-child {
    box-shadow: inset 1px 0 0 var(--color-border-secondary);
  }
}

.col-task {
  width: calc(17.647059% - 21.176471px);
}
.col-template {
  width: calc(17.647059% - 21.176471px);
}
.col-windows {
  width: calc(16.470588% - 19.764706px);
}
.col-created {
  width: calc(14.117647% - 16.941176px);
}
.col-schedule {
  width: calc(18.823529% - 22.588235px);
}
.col-status {
  width: calc(15.294118% - 18.352941px);
}
.col-actions {
  width: 120px;
}

.task-manager-content--en {
  .col-task,
  .col-template {
    width: calc(17.647059% - 24.705882px);
  }
  .col-windows {
    width: calc(16.470588% - 23.058824px);
  }
  .col-created {
    width: calc(14.117647% - 19.764706px);
  }
  .col-schedule {
    width: calc(18.823529% - 26.352941px);
  }
  .col-status {
    width: calc(15.294118% - 21.411765px);
  }
  .col-actions {
    width: 125px;
  }
}

.task-manager-content--ru {
  .col-task,
  .col-template {
    width: calc(17.647059% - 38.823529px);
  }
  .col-windows {
    width: calc(16.470588% - 36.235294px);
  }
  .col-created {
    width: calc(14.117647% - 31.058824px);
  }
  .col-schedule {
    width: calc(18.823529% - 41.411765px);
  }
  .col-status {
    width: calc(20%);
  }
  .col-actions {
    width: 190px;
  }
}

.task-name-cell {
  font-weight: 500;
}

.template-badge {
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  min-width: 0;
  height: 24px;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 8px;
  background: var(--color-bg-tertiary);
  font-size: 14px;
  line-height: 20px;

  > :first-child {
    flex: 0 0 auto;
  }
}

.template-badge--link {
  appearance: none;
  border: none;
  font-family: inherit;
  color: inherit;
  cursor: pointer;
  text-align: left;

  &:hover:not(:disabled) {
    background: var(--color-bg-quaternary);
  }

  &:disabled {
    cursor: default;
  }

  > .template-badge__name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.status-pill,
.activity-status {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 4px;
  padding: 2px 7px 2px 8px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 999px;
  font-size: 14px;
  line-height: 20px;
  white-space: nowrap;
}

.status-pill {
  background: transparent;
  font-family: inherit;
}

.status-pill--add-plan {
  padding: 2px 8px 2px 6px;
  border-style: dashed;
  color: var(--color-text-primary);
  cursor: pointer;

  &:hover {
    background: var(--color-bg-tertiary);
  }

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.status-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: currentColor;
}

.status-pill.scheduled {
  color: #2e90fa;
}
.status-pill.paused {
  color: #f79009;
}
.status-pill.manual {
  color: var(--color-text-quaternary);
}
.status-pill.preparing {
  color: #2e90fa;
}
.status-pill.running {
  color: #f359dc;
}
.status-pill.stopping {
  color: #f79009;
}

.task-actions {
  display: flex;
  width: max-content;
  align-items: center;
  gap: 4px;
}

.run-button {
  height: 28px;
  padding: 4px 8px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  line-height: 20px;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
}

.stop-task-button {
  min-width: 72px;
  height: 28px;
  flex: 0 0 auto;
  padding: 4px 8px;
  border-radius: 8px;
  color: #fff;
  background: #f04438;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;

  &:not(:disabled):hover {
    background: #d92d20;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }
}

.icon-button {
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  border-radius: 8px;
  color: var(--color-text-primary);
  background: transparent;
  cursor: pointer;

  &:hover {
    background: var(--color-bg-quaternary);
  }
}

.task-state {
  display: flex;
  min-height: 260px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  color: var(--color-text-quaternary);
  text-align: center;

  img {
    width: 32px;
    height: 32px;
  }

  strong {
    color: var(--color-text-primary);
    font-size: 15px;
    font-weight: 500;
  }

  span {
    font-size: 13px;
  }
}

.state-action {
  height: 32px;
  padding: 6px 12px;
  border-radius: 10px;
  color: var(--color-bg-primary);
  background: var(--color-bg-primary);
  cursor: pointer;
}

.activity-table {
  min-width: 980px;
}

.activity-paginator {
  --paginator-background: var(--color-bg-primary);
  --paginator-padding: 12px 0 0;

  border-radius: 0;

  :deep(.p-paginator-content-start) {
    min-width: 0;
    flex: 1;
  }

  :deep(.p-paginator-prev),
  :deep(.p-paginator-next),
  :deep(.p-paginator-page) {
    width: 24px;
    min-width: auto;
    height: 24px;
    border-radius: var(--radius-sm, 4px);
  }

  :deep(.p-paginator-page) {
    color: var(--color-text-primary);
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
  }

  :deep(.p-paginator-page-selected) {
    width: 28px;
    height: 28px;
    border: 1px solid var(--color-border-primary-inverse);
    border-radius: 8px;
    color: var(--color-text-primary);
    background: var(--color-bg-primary);
  }

  :deep(.p-paginator-prev),
  :deep(.p-paginator-next) {
    color: var(--color-fg-primary);
  }

  :deep(.p-paginator-prev:disabled),
  :deep(.p-paginator-next:disabled) {
    color: var(--color-fg-disabled);
  }

  :deep(.p-inputtext) {
    width: 60px;
    height: 28px;
    padding: 4px 6px;
    border: 1px solid var(--color-border-primary);
    border-radius: 8px;
    font-size: 14px;
    line-height: 20px;
    text-align: center;

    &:focus {
      border-color: var(--color-border-primary-inverse);
      box-shadow: none;
      outline: none;
    }
  }
}

.activity-paginator-start {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  line-height: 20px;
}

.activity-paginator-total,
.activity-paginator-jump-label {
  color: var(--color-text-tertiary);
}

.activity-page-size-select {
  width: fit-content;
  min-width: 88px;
  height: 30px;

  :deep(.p-select-label) {
    padding-block: 4px;
    font-size: 14px;
    line-height: 20px;
  }
}

.activity-paginator-jump-label {
  flex: 1;
  text-align: right;
}

.col-activity-task {
  width: calc(19.117647% - 22.941176px);
}
.col-activity-template {
  width: calc(17.647059% - 21.176471px);
}
.col-activity-windows {
  width: calc(19.117647% - 22.941176px);
}
.col-activity-started {
  width: calc(18.176471% - 10px);
}
.col-activity-ended {
  width: calc(18.176471% - 10px);
}
.col-activity-status {
  width: calc(8.764705% - 14.117647px);
}
.col-activity-actions {
  width: 120px;
}

.task-manager-content--en {
  .col-activity-task,
  .col-activity-windows {
    width: calc(19.117647% - 26.726847px);
  }
  .col-activity-template {
    width: calc(17.647059% - 24.670538px);
  }
  .col-activity-started,
  .col-activity-ended {
    width: calc(18.176471% - 13.599301px);
  }
  .col-activity-status {
    width: calc(8.764705% - 15.853232px);
  }
  .col-activity-actions {
    width: 140px;
  }
}

.task-manager-content--ru {
  .col-activity-task,
  .col-activity-windows {
    width: calc(19.117647% - 41.869539px);
  }
  .col-activity-template {
    width: calc(17.647059% - 38.648807px);
  }
  .col-activity-started,
  .col-activity-ended {
    width: calc(18.176471% - 27.996506px);
  }
  .col-activity-status {
    width: calc(8.764705% - 22.795573px);
  }
  .col-activity-actions {
    width: 230px;
  }
}

.activity-actions {
  gap: 6px;
}

.view-logs-button {
  display: inline-flex;
  height: 28px;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 8px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;

  &:hover {
    background: var(--color-bg-quaternary);
  }
}

.activity-status.success {
  color: #17b26a;
}
.activity-status.preparing {
  color: #2e90fa;
}
.activity-status.running {
  color: #f359dc;
}
.activity-status.stopping {
  color: #f79009;
}
.activity-status.partial_failed {
  color: #f79009;
}
.activity-status.failed {
  color: #f04438;
}
.activity-status.interrupted {
  color: #f04438;
}
.activity-status.skipped {
  color: var(--color-text-quaternary);
}

.activity-status.running {
  .status-dot {
    background: linear-gradient(148deg, #3faaf6 10%, #f359dc 45%, #f28fb0 100%);
  }

  .activity-status-label {
    color: transparent;
    background: linear-gradient(148deg, #3faaf6 10%, #f359dc 45%, #f28fb0 100%);
    background-clip: text;
  }
}

:global(.task-action-popover) {
  display: flex;
  width: 148px;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  background: var(--color-bg-primary);
  box-shadow: 0 12px 32px rgb(15 15 15 / 12%);
}

:global(.task-action-popover button) {
  display: flex;
  width: 100%;
  height: 32px;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 0;
  border-radius: 7px;
  color: var(--color-text-primary);
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  text-align: left;
}

:global(.task-action-popover button:hover) {
  background: var(--color-bg-quaternary);
}

:global(.task-action-popover button:disabled) {
  cursor: not-allowed;
  opacity: 0.45;
}

:global(.task-action-popover.task-list-action-popover) {
  width: 140px;
  gap: 4px;
  padding: 12px;
  border-radius: 16px;
  box-shadow:
    0 1px 1px rgb(0 0 0 / 4%),
    0 2px 8px rgb(0 0 0 / 4%),
    0 3px 17px rgb(0 0 0 / 4%),
    0 4px 30px rgb(0 0 0 / 12%);
}

:global(.task-action-popover.task-list-action-popover button) {
  height: 36px;
  padding: 8px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 20px;
}

:global(.task-action-popover button.danger) {
  color: var(--color-text-error-primary, #f04438);
}

@media (max-width: 760px) {
  .task-list-toolbar {
    align-items: flex-start;
  }

  .activity-paginator-start {
    flex-wrap: wrap;
  }

  .activity-paginator-jump-label {
    display: none;
  }
}

@media (max-width: 420px) {
  .task-list-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .new-task-button {
    width: 100%;
  }
}
</style>
