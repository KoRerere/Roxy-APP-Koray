import type {
  AgentTask,
  AgentTaskEvent,
  AgentTaskGroup,
  TaskMonitorSnapshotDTO,
  TaskMonitorTaskDTO,
} from '../types'
import { useAgentChannelState } from './useAgentChannel'

interface TaskMonitorState {
  groups: AgentTaskGroup[]
  lastUpdatedAt?: number
}

const state = reactive<TaskMonitorState>({ groups: [] })
const expandedByGroupId = new Map<string, boolean>()

function capitalize(value: string): string {
  if (!value)
    return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function humanizeToolName(toolName: string): string {
  return toolName
    .replace(/^roxybrowser_playwright__/, '')
    .replace(/^roxybrowser_playwright_/, '')
    .replace(/^roxy_browser_/, '')
    .replace(/^browser_/, '')
    .replace(/_/g, ' ')
    .trim()
}

function readStringValue(input: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!input)
    return undefined
  for (const key of keys) {
    const value = input[key]
    if (typeof value === 'string' && value.trim())
      return value.trim()
    if (typeof value === 'number')
      return String(value)
  }
  return undefined
}

function getEventTarget(input?: Record<string, unknown>): string | undefined {
  return readStringValue(input, ['dirId', 'dir_id', 'browserId', 'browser_id', 'url', 'selector', 'ref', 'element', 'text', 'value', 'command', 'scriptPath', 'prompt', 'query', 'name'])
}

function summarizeEvent(event: AgentTaskEvent): string {
  if (event.stage === 'error')
    return event.errorMessage ? `Error · ${event.errorMessage}` : `${humanizeToolName(event.toolName)} failed`

  const action = humanizeToolName(event.toolName)
  const target = getEventTarget(event.input)
  if (event.stage === 'start')
    return target ? `${action} · ${target}` : action

  if (event.result)
    return target ? `${action} · ${target}` : event.result

  return target ? `${action} · ${target}` : `${capitalize(action)} done`
}

function mapEvent(event: TaskMonitorTaskDTO['browsers'][number]['events'][number]): AgentTaskEvent {
  const mapped: AgentTaskEvent = {
    id: event.id,
    stage: event.stage,
    toolName: event.toolName,
    input: event.input as Record<string, unknown> | undefined,
    result: event.result,
    success: event.success,
    errorMessage: event.errorMessage,
    durationMs: event.durationMs,
    timestamp: event.timestamp,
    workerId: event.workerId,
    conversationId: event.conversationId,
  }
  mapped.summary = summarizeEvent(mapped)
  return mapped
}

function mapBrowserToTask(task: TaskMonitorTaskDTO, browser: TaskMonitorTaskDTO['browsers'][number]): AgentTask {
  const events = browser.events.map(mapEvent)
  const latestEvent = events.at(-1)

  return {
    id: browser.id,
    conversationId: task.conversationId ?? task.id,
    runId: task.runId,
    name: browser.windowName || browser.label || browser.dirId || browser.id,
    subtitle: latestEvent?.summary ?? browser.dirId ?? browser.ws ?? 'Browser session',
    status: 'running',
    dirId: browser.dirId,
    ws: browser.ws,
    browserType: browser.browserType,
    windowName: browser.windowName,
    windowSortNum: browser.windowSortNum,
    platformUrl: browser.platformUrl,
    platformUserName: browser.platformUserName,
    platformIcon: browser.platformIcon,
    countryCode: browser.countryCode,
    events,
  }
}

function mapSnapshot(snapshot: TaskMonitorSnapshotDTO): AgentTaskGroup[] {
  return snapshot.data.tasks.map((task) => {
    const browsers = task.browsers.map(browser => mapBrowserToTask(task, browser))
    const latestActivity = task.browsers.reduce((acc, browser) => Math.max(acc, browser.updatedAt), task.updatedAt)
    const persistedExpanded = expandedByGroupId.get(task.id)
    const expanded = persistedExpanded ?? (browsers.length > 0 && expandedByGroupId.size === 0)
    expandedByGroupId.set(task.id, expanded)

    return {
      id: task.id,
      conversationId: task.conversationId ?? task.id,
      runId: task.runId,
      title: task.title,
      description: `${capitalize(task.sourceType)} task`,
      expanded,
      sourceType: task.sourceType,
      browserCount: browsers.length,
      lastActivityAt: latestActivity,
      tasks: browsers,
    }
  })
}

function applySnapshot(snapshot: TaskMonitorSnapshotDTO): void {
  const nextGroups = mapSnapshot(snapshot)
  const nextIds = new Set(nextGroups.map(group => group.id))
  for (const groupId of Array.from(expandedByGroupId.keys())) {
    if (!nextIds.has(groupId))
      expandedByGroupId.delete(groupId)
  }
  state.groups = nextGroups
  state.lastUpdatedAt = snapshot.data.generatedAt
}

export function useTaskMonitor() {
  const channel = useAgentChannelState()
  const taskGroupList = computed(() => state.groups)
  const runningTaskCount = computed(() => state.groups.reduce((sum, group) => sum + group.tasks.length, 0))

  watch(
    channel.taskMonitorSnapshot,
    (snapshot) => {
      if (snapshot)
        applySnapshot(snapshot)
    },
    { immediate: true },
  )

  function toggleTaskGroup(groupId: string) {
    const nextExpanded = !(expandedByGroupId.get(groupId) ?? false)
    expandedByGroupId.set(groupId, nextExpanded)
    state.groups = state.groups.map(group => (group.id === groupId ? { ...group, expanded: nextExpanded } : group))
  }

  return {
    connected: channel.connected,
    lastError: channel.lastError,
    lastUpdatedAt: computed(() => state.lastUpdatedAt),
    runningTaskCount,
    taskGroupList,
    toggleTaskGroup,
  }
}
