import type {
  AgentChannelMessage,
  AgentTaskExecutionDetailDTO,
  AgentTaskExecutionEvent,
  AgentTaskExecutionReplay,
  AgentTaskLogDTO,
  AgentTaskMonitorSnapshot,
} from '@roxy/shared/channel'

export interface AgentChannelDataState {
  taskLogs: AgentTaskLogDTO[]
  taskLogsReady: boolean
  taskExecutionDetails: Record<string, AgentTaskExecutionDetailDTO>
  taskExecutionReady: boolean
  taskExecutionGapDetected: boolean
  taskMonitorSnapshot?: AgentTaskMonitorSnapshot
}

export interface AgentChannelDedupState {
  seenMessageIds: Map<string, number>
}

export function collectTaskConversationIds(
  state: Pick<AgentChannelDataState, 'taskLogs' | 'taskExecutionDetails'>,
): string[] {
  return Array.from(new Set([
    ...state.taskLogs.map(log => log.conversationId),
    ...Object.values(state.taskExecutionDetails).map(detail => detail.conversationId),
  ].filter((id): id is string => Boolean(id))))
}

const MAX_SEEN_MESSAGE_IDS = 5000
const SEEN_MESSAGE_TTL_MS = 30 * 60 * 1000

export function createAgentChannelDedupState(): AgentChannelDedupState {
  return { seenMessageIds: new Map() }
}

function sortTaskLogs(logs: AgentTaskLogDTO[]): AgentTaskLogDTO[] {
  return logs.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
}

function replaceTaskLogs(state: AgentChannelDataState, logs: AgentTaskLogDTO[]): void {
  state.taskLogs = sortTaskLogs([...logs])
  state.taskLogsReady = true
  pruneTaskExecutionDetails(state)
}

function upsertTaskLog(state: AgentChannelDataState, log: AgentTaskLogDTO): void {
  const next = state.taskLogs.filter(item => item.id !== log.id)
  next.push(log)
  state.taskLogs = sortTaskLogs(next)
  pruneTaskExecutionDetails(state)
}

function pruneTaskExecutionDetails(state: AgentChannelDataState): void {
  const keep = new Set([
    ...state.taskLogs.filter(log => log.status === 'preparing' || log.status === 'running')
      .map(log => log.id),
    ...state.taskLogs.slice(0, 5).map(log => log.id),
  ])
  const next = Object.fromEntries(
    Object.entries(state.taskExecutionDetails).filter(([taskLogId]) => keep.has(taskLogId)),
  )
  if (Object.keys(next).length !== Object.keys(state.taskExecutionDetails).length)
    state.taskExecutionDetails = next
}

function emptyTaskExecutionDetail(taskLogId: string): AgentTaskExecutionDetailDTO {
  return {
    taskLogId,
    revision: 0,
    conversationId: null,
    messages: [],
    artifacts: [],
    scriptWindows: [],
  }
}

function applyTaskExecutionEvent(
  state: AgentChannelDataState,
  event: AgentTaskExecutionEvent,
): void {
  const current = state.taskExecutionDetails[event.taskLogId]
    ?? emptyTaskExecutionDetail(event.taskLogId)
  if (event.sequence <= current.revision)
    return
  if (event.sequence !== current.revision + 1) {
    state.taskExecutionGapDetected = true
    return
  }

  const detail: AgentTaskExecutionDetailDTO = {
    ...current,
    messages: [...current.messages],
    artifacts: [...current.artifacts],
    scriptWindows: current.scriptWindows.map(window => ({
      ...window,
      artifacts: [...window.artifacts],
      failedFiles: [...window.failedFiles],
    })),
  }
  const payload = event.payload

  if (payload.type === 'agent.message.upsert') {
    detail.conversationId = payload.conversationId
    const index = detail.messages.findIndex(message => message.id === payload.message.id)
    if (index >= 0)
      detail.messages[index] = payload.message
    else
      detail.messages.push(payload.message)
  }
  else if (payload.type === 'agent.message.delta') {
    detail.conversationId = payload.conversationId
    const existing = detail.messages.find(message => message.id === payload.messageId)
    if (existing) {
      existing.content += payload.delta
    }
    else {
      detail.messages.push({
        id: payload.messageId,
        role: 'assistant',
        content: payload.delta,
        createdAt: payload.createdAt,
      })
    }
  }
  else if (payload.type === 'script.window.started') {
    const existing = detail.scriptWindows.find(window => window.key === payload.window.key)
    const next = {
      ...payload.window,
      status: 'running' as const,
      log: '',
      artifacts: [],
      failedFiles: [],
    }
    if (existing)
      Object.assign(existing, next)
    else
      detail.scriptWindows.push(next)
  }
  else if (payload.type === 'script.log.append' || payload.type === 'script.log.replace') {
    const window = detail.scriptWindows.find(item => item.key === payload.windowKey)
    if (window)
      window.log = payload.type === 'script.log.append' ? `${window.log}${payload.text}` : payload.text
  }
  else if (payload.type === 'script.window.finished') {
    const window = detail.scriptWindows.find(item => item.key === payload.windowKey)
    if (window) {
      window.status = payload.status
      window.failedFiles = [...payload.failedFiles]
    }
  }
  else if (payload.type === 'artifacts.updated') {
    if (payload.windowKey) {
      const window = detail.scriptWindows.find(item => item.key === payload.windowKey)
      if (window)
        window.artifacts = [...payload.artifacts]
    }
    else {
      detail.artifacts = [...payload.artifacts]
    }
  }

  detail.revision = event.sequence
  state.taskExecutionDetails = {
    ...state.taskExecutionDetails,
    [event.taskLogId]: detail,
  }
}

export function replaceTaskExecutionReplays(
  state: AgentChannelDataState,
  items: AgentTaskExecutionReplay[],
): void {
  state.taskExecutionDetails = {}
  state.taskExecutionGapDetected = false
  for (const item of items) {
    state.taskExecutionDetails[item.taskLogId] = emptyTaskExecutionDetail(item.taskLogId)
    for (const event of [...item.events].sort((a, b) => a.sequence - b.sequence))
      applyTaskExecutionEvent(state, event)
    if (state.taskExecutionDetails[item.taskLogId]?.revision !== item.revision)
      state.taskExecutionGapDetected = true
  }
  state.taskExecutionReady = true
}

function pruneSeenMessageIds(state: AgentChannelDedupState, now: number): void {
  for (const [id, seenAt] of state.seenMessageIds) {
    if (now - seenAt <= SEEN_MESSAGE_TTL_MS && state.seenMessageIds.size <= MAX_SEEN_MESSAGE_IDS)
      break
    state.seenMessageIds.delete(id)
  }
}

function isDuplicateMessage(state: AgentChannelDedupState, id: string, now: number): boolean {
  pruneSeenMessageIds(state, now)
  if (state.seenMessageIds.has(id))
    return true
  state.seenMessageIds.set(id, now)
  return false
}

export function applyAgentChannelMessage(
  state: AgentChannelDataState,
  dedupState: AgentChannelDedupState,
  message: AgentChannelMessage,
  now = Date.now(),
): boolean {
  if (isDuplicateMessage(dedupState, message.id, now))
    return false

  if (message.type === 'task_logs.snapshot') {
    replaceTaskLogs(state, message.data.items)
  }
  else if (message.type === 'task_log.changed') {
    upsertTaskLog(state, message.data)
  }
  else if (message.type === 'task_log.deleted') {
    state.taskLogs = state.taskLogs.filter(log => log.id !== message.data.logId)
    const next = { ...state.taskExecutionDetails }
    delete next[message.data.logId]
    state.taskExecutionDetails = next
  }
  else if (message.type === 'task_execution.event') {
    applyTaskExecutionEvent(state, message.data)
  }
  else if (message.type === 'task_monitor.snapshot') {
    state.taskMonitorSnapshot = message.data
  }

  return true
}
