import type {
  AgentTask,
  AgentTaskEvent,
  AgentTaskGroup,
  ProfileMonitorProfileDTO,
  ProfileMonitorSnapshotDTO,
  TaskMonitorSnapshotDTO,
  TaskMonitorTaskDTO,
} from '../types'
import { friendlyToolName } from '../toolName'
import { useAgentChannelState } from './useAgentChannel'

interface TaskMonitorState {
  groups: AgentTaskGroup[]
  lastUpdatedAt?: number
}

const state = reactive<TaskMonitorState>({ groups: [] })
const expandedByGroupId = new Map<string, boolean>()
let receivedProfileSnapshot = false

function capitalize(value: string): string {
  if (!value) {
    return value
  }
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function summarizeEvent(event: AgentTaskEvent): string {
  const status = event.stage === 'end' && event.success ? 'success' : 'running'
  const label = friendlyToolName(event.toolName, status, event.input)
  if (event.stage === 'error') {
    return event.errorMessage ? `${label}：${event.errorMessage}` : label
  }

  return label
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
      kind: 'running',
    }
  })
}

function mapProfile(profile: ProfileMonitorProfileDTO): AgentTask {
  const events = profile.events.map(mapEvent)
  const latestEvent = events.at(-1)
  return {
    id: profile.dirId,
    conversationId: profile.owner?.conversationId ?? profile.dirId,
    runId: profile.owner?.runId,
    name: profile.windowName || profile.platformUserName || profile.dirId,
    subtitle: latestEvent?.summary ?? profile.dirId ?? profile.endpoint ?? 'Browser session',
    status: profile.status,
    dirId: profile.dirId,
    ws: profile.endpoint,
    browserType: profile.browserType,
    windowName: profile.windowName,
    windowSortNum: profile.windowSortNum,
    platformUrl: profile.platformUrl,
    platformUserName: profile.platformUserName,
    platformIcon: profile.platformIcon,
    countryCode: profile.countryCode,
    events,
  }
}

export function mapProfileSnapshot(snapshot: ProfileMonitorSnapshotDTO): AgentTaskGroup[] {
  const groups = new Map<string, AgentTaskGroup>()
  const idleTasks: AgentTask[] = []
  for (const profile of snapshot.data.profiles) {
    const task = mapProfile(profile)
    if (profile.status === 'idle' || !profile.owner) {
      idleTasks.push(task)
      continue
    }
    const owner = profile.owner
    let group = groups.get(owner.taskId)
    if (!group) {
      const expanded = expandedByGroupId.get(owner.taskId) ?? true
      expandedByGroupId.set(owner.taskId, expanded)
      group = {
        id: owner.taskId,
        conversationId: owner.conversationId ?? owner.taskId,
        runId: owner.runId,
        title: owner.title,
        description: `${capitalize(owner.sourceType)} task`,
        expanded,
        sourceType: owner.sourceType,
        browserCount: 0,
        lastActivityAt: profile.updatedAt,
        tasks: [],
        kind: 'running',
      }
      groups.set(owner.taskId, group)
    }
    group.tasks.push(task)
    group.browserCount = group.tasks.length
    group.lastActivityAt = Math.max(group.lastActivityAt ?? 0, profile.updatedAt)
  }

  const result = [...groups.values()].sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0))
  if (idleTasks.length > 0) {
    const idleId = 'profile-monitor-idle'
    const expanded = expandedByGroupId.get(idleId) ?? false
    expandedByGroupId.set(idleId, expanded)
    result.push({
      id: idleId,
      conversationId: idleId,
      title: '',
      description: '',
      expanded,
      browserCount: idleTasks.length,
      lastActivityAt: Math.max(...snapshot.data.profiles.filter(profile => profile.status === 'idle').map(profile => profile.updatedAt)),
      tasks: idleTasks.sort((a, b) => a.name.localeCompare(b.name)),
      kind: 'idle',
    })
  }
  return result
}

function applySnapshot(snapshot: TaskMonitorSnapshotDTO): void {
  const nextGroups = mapSnapshot(snapshot)
  const nextIds = new Set(nextGroups.map(group => group.id))
  for (const groupId of Array.from(expandedByGroupId.keys())) {
    if (!nextIds.has(groupId)) {
      expandedByGroupId.delete(groupId)
    }
  }
  state.groups = nextGroups
  state.lastUpdatedAt = snapshot.data.generatedAt
}

function applyProfileSnapshot(snapshot: ProfileMonitorSnapshotDTO): void {
  receivedProfileSnapshot = true
  state.groups = mapProfileSnapshot(snapshot)
  state.lastUpdatedAt = snapshot.data.generatedAt
}

export function useProfileMonitor() {
  const channel = useAgentChannelState()
  const taskGroupList = computed(() => state.groups)
  const runningTaskCount = computed(() => state.groups.reduce(
    (sum, group) => sum + group.tasks.filter(task => task.status === 'running').length,
    0,
  ))
  const profileCount = computed(() => state.groups.reduce((sum, group) => sum + group.tasks.length, 0))

  watch(
    channel.profileMonitorSnapshot,
    (snapshot) => {
      receivedProfileSnapshot = Boolean(snapshot)
      if (snapshot) {
        applyProfileSnapshot(snapshot)
      }
    },
    { immediate: true },
  )

  watch(
    channel.taskMonitorSnapshot,
    (snapshot) => {
      if (snapshot && !receivedProfileSnapshot) {
        applySnapshot(snapshot)
      }
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
    profileCount,
    taskGroupList,
    toggleTaskGroup,
  }
}
