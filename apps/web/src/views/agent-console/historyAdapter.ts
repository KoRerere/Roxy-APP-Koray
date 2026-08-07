import type {
  AgentAttachment,
  AgentContentProcessEvent,
  AgentConversation,
  AgentConversationProcess,
  AgentFileArtifact,
  AgentFileProcessEvent,
  AgentFinalAnswerProcessEvent,
  AgentMessage,
  AgentParallelDispatchProcessEvent,
  AgentProcessEvent,
  AgentProcessEventStatus,
  AgentScriptLogProcessEvent,
  AgentSkillLoadProcessEvent,
  AgentThinkingProcessEvent,
  AgentToolCallProcessEvent,
  AgentWorkerTaskProcessEvent,
} from './types'
import type { AgentConsoleConversationDetailDTO, AgentConsoleConversationDTO, AgentConsoleConversationMessageDTO } from './api'
import type { AgentConversationRunEventDTO } from '@roxy/shared/channel'
import type { AgentErrorData } from './utils/agent-error'
import { isAgentCancelledError, resolveAgentError } from './utils/agent-error'

interface ProcessBuildContext {
  rootEvents: AgentProcessEvent[]
  eventByKey: Map<string, AgentProcessEvent>
  workerByTaskId: Map<string, AgentWorkerTaskProcessEvent>
  parallelDispatch?: AgentParallelDispatchProcessEvent
  finalAnswer?: AgentFinalAnswerProcessEvent
  firstTimestamp?: number
  lastTimestamp?: number
  endStatus?: 'completed' | 'failed' | 'cancelled'
  errorMessage?: string
  errorData?: AgentErrorData | string
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function formatTime(value?: string | number) {
  if (!value)
    return ''

  const date = new Date(typeof value === 'number' && value < 10000000000 ? value * 1000 : value)
  if (Number.isNaN(date.getTime()))
    return `${value}`

  const pad = (n: number) => `${n}`.padStart(2, '0')
  const now = new Date()
  const sameYear = date.getFullYear() === now.getFullYear()
  const datePart = sameYear
    ? `${pad(date.getMonth() + 1)}/${pad(date.getDate())}`
    : `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`

  return `${datePart} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatDuration(ms: number) {
  if (ms < 1000)
    return `${$t('任务耗时')} 1s`

  const seconds = Math.round(ms / 1000)
  if (seconds < 60)
    return `${$t('任务耗时')} ${seconds}s`

  const minutes = Math.floor(seconds / 60)
  const restSeconds = seconds % 60
  return restSeconds > 0 ? `${$t('任务耗时')} ${minutes}m${restSeconds}s` : `${$t('任务耗时')} ${minutes}m`
}

function normalizeStatus(value: unknown): AgentProcessEventStatus {
  if (value === 'pending' || value === 'running' || value === 'success' || value === 'failed')
    return value

  return value === 'error' || value === 'cancelled' ? 'failed' : 'success'
}

function getOrCreateThinking(
  targetEvents: AgentProcessEvent[],
  eventByKey: Map<string, AgentProcessEvent>,
  key: string,
  id: string,
): AgentThinkingProcessEvent {
  const existing = eventByKey.get(key)
  if (existing?.type === 'thinking')
    return existing

  const event: AgentThinkingProcessEvent = {
    id,
    type: 'thinking',
    title: '思考过程',
    expanded: false,
    status: 'running',
    content: '',
  }
  eventByKey.set(key, event)
  targetEvents.push(event)
  return event
}

function getOrCreateContent(
  targetEvents: AgentProcessEvent[],
  eventByKey: Map<string, AgentProcessEvent>,
  key: string,
  id: string,
  emphasis = false,
): AgentContentProcessEvent {
  const existing = eventByKey.get(key)
  if (existing?.type === 'content')
    return existing

  const event: AgentContentProcessEvent = {
    id,
    type: 'content',
    content: '',
    emphasis,
  }
  eventByKey.set(key, event)
  targetEvents.push(event)
  return event
}

function getOrCreateTool(
  targetEvents: AgentProcessEvent[],
  eventByKey: Map<string, AgentProcessEvent>,
  key: string,
  id: string,
  data: Record<string, unknown>,
): AgentToolCallProcessEvent {
  const existing = eventByKey.get(key)
  if (existing?.type === 'tool_call')
    return existing

  const toolName = asString(data.toolName) || 'tool'
  const event: AgentToolCallProcessEvent = {
    id,
    type: 'tool_call',
    toolName,
    target: asString(data.target),
    status: 'running',
  }
  eventByKey.set(key, event)
  targetEvents.push(event)
  return event
}

function getOrCreateScriptLog(
  context: ProcessBuildContext,
  targetEvents: AgentProcessEvent[],
  key: string,
  id: string,
  data: Record<string, unknown>,
): AgentScriptLogProcessEvent {
  const existing = context.eventByKey.get(key)
  if (existing?.type === 'script_log') {
    const scriptName = asString(data.scriptName)
    if (scriptName && existing.scriptName !== scriptName) {
      existing.scriptName = scriptName
      existing.title = `${$t('运行脚本')} ${scriptName}`
    }
    return existing
  }

  const scriptName = asString(data.scriptName)
  const event: AgentScriptLogProcessEvent = {
    id,
    type: 'script_log',
    title: scriptName ? `${$t('运行脚本')} ${scriptName}` : $t('运行脚本'),
    expanded: false,
    status: 'running',
    scriptName,
    lines: [],
  }
  context.eventByKey.set(key, event)
  targetEvents.push(event)
  return event
}

function getOrCreateAgentFiles(context: ProcessBuildContext): AgentFileProcessEvent {
  const key = 'agent-files'
  const existing = context.eventByKey.get(key)
  if (existing?.type === 'agent_file')
    return existing

  const event: AgentFileProcessEvent = {
    id: key,
    type: 'agent_file',
    title: $t('产物文件'),
    status: 'success',
    files: [],
  }
  context.eventByKey.set(key, event)
  context.rootEvents.push(event)
  return event
}

function appendScriptLog(context: ProcessBuildContext, data: Record<string, unknown>) {
  const workerId = asString(data.workerId)
  const groupId = asString(data.toolId) || asString(data.scriptRunId) || asString(data.scriptName) || 'default'
  const targetEvents = workerId ? ensureWorkerTask(context, workerId).events : context.rootEvents
  const event = getOrCreateScriptLog(
    context,
    targetEvents,
    `script:${workerId}:${groupId}`,
    `script-log-${workerId || 'root'}-${groupId}`,
    data,
  )
  const message = asString(data.message) || asString(data.text)
  if (!message)
    return

  event.lines.push({
    level: asString(data.level) || 'info',
    message,
  })
}

function appendAgentFile(context: ProcessBuildContext, data: Record<string, unknown>) {
  const fileId = asString(data.fileId)
  const fileName = asString(data.fileName)
  if (!fileId || !fileName)
    return

  const files = getOrCreateAgentFiles(context)
  const item: AgentFileArtifact = {
    fileId,
    fileName,
    size: asNumber(data.size) ?? 0,
    mimeType: asString(data.mimeType) || 'application/octet-stream',
    op: data.op === 'update' ? 'update' : 'create',
  }
  const existingIndex = files.files.findIndex(file => file.fileId === item.fileId)
  if (existingIndex >= 0)
    files.files[existingIndex] = item
  else
    files.files.push(item)
}

function ensureParallelDispatch(context: ProcessBuildContext, requestedCount?: number) {
  if (context.parallelDispatch)
    return context.parallelDispatch

  const event: AgentParallelDispatchProcessEvent = {
    id: 'parallel-dispatch',
    type: 'parallel_dispatch',
    title: requestedCount ? `创建 ${requestedCount} 个并行任务` : '创建并行任务',
    count: requestedCount ?? 0,
    expanded: false,
    status: 'running',
    tasks: [],
  }

  context.parallelDispatch = event
  context.rootEvents.push(event)
  return event
}

function ensureWorkerTask(context: ProcessBuildContext, taskId: string, title?: string) {
  const existing = context.workerByTaskId.get(taskId)
  if (existing) {
    if (title)
      existing.title = title
    return existing
  }

  const worker: AgentWorkerTaskProcessEvent = {
    id: `worker-${taskId}`,
    type: 'worker_task',
    title: title || '执行并行任务',
    expanded: false,
    status: 'running',
    events: [],
  }

  context.workerByTaskId.set(taskId, worker)
  const parallelDispatch = ensureParallelDispatch(context)
  parallelDispatch.tasks.push(worker)
  parallelDispatch.count = Math.max(parallelDispatch.count, parallelDispatch.tasks.length)
  parallelDispatch.title = `创建 ${parallelDispatch.count} 个并行任务`
  return worker
}

function appendFinalAnswer(context: ProcessBuildContext, content: string) {
  if (!context.finalAnswer) {
    context.finalAnswer = {
      id: 'final-answer',
      type: 'final_answer',
      content: '',
    }
    context.rootEvents.push(context.finalAnswer)
  }

  context.finalAnswer.content += content
}

function promoteLastRootContentToFinalAnswer(context: ProcessBuildContext) {
  if (context.finalAnswer?.content.trim())
    return

  for (let index = context.rootEvents.length - 1; index >= 0; index--) {
    const event = context.rootEvents[index]
    if (event.type !== 'content' || !event.content.trim())
      continue

    context.finalAnswer = {
      id: 'final-answer',
      type: 'final_answer',
      content: event.content,
    }
    context.rootEvents.splice(index, 1, context.finalAnswer)
    return
  }
}

function markThinkingComplete(context: ProcessBuildContext, thinkingId: string, taskId?: string) {
  const key = taskId ? `worker:${taskId}:thinking:${thinkingId}` : `thinking:${thinkingId}`
  const event = context.eventByKey.get(key)
  if (event?.type === 'thinking')
    event.status = 'success'
}

function handleToolCall(context: ProcessBuildContext, data: Record<string, unknown>) {
  const toolName = asString(data.toolName) || 'tool'
  const taskId = asString(data.taskId)
  const toolId = asString(data.toolId) || `${toolName}-${context.eventByKey.size}`

  if (toolName === 'parallel_dispatch') {
    ensureParallelDispatch(context, asNumber(data.assignmentsCount))
    return
  }

  if (toolName === 'load_skill_file') {
    const skillPath = asString(data.skillFilePath) || asString(data.skillName) || 'skill'
    const event: AgentSkillLoadProcessEvent = {
      id: `skill-${toolId}`,
      type: 'skill_load',
      skillPath,
      status: 'running',
    }

    context.eventByKey.set(`skill:${toolId}`, event)
    if (taskId)
      ensureWorkerTask(context, taskId).events.push(event)
    else
      context.rootEvents.push(event)
    return
  }

  const targetEvents = taskId ? ensureWorkerTask(context, taskId).events : context.rootEvents
  if (toolName === 'run_script') {
    getOrCreateScriptLog(
      context,
      targetEvents,
      `script:${taskId}:${toolId}`,
      `script-log-${taskId || 'root'}-${toolId}`,
      { ...data, scriptName: asString(data.target) },
    )
    return
  }

  getOrCreateTool(targetEvents, context.eventByKey, `tool:${taskId}:${toolId}`, `tool-${toolId}`, data)
}

function handleToolResult(context: ProcessBuildContext, data: Record<string, unknown>) {
  const toolName = asString(data.toolName) || 'tool'
  const taskId = asString(data.taskId)
  const toolId = asString(data.toolId) || `${toolName}-${context.eventByKey.size}`

  const skillEvent = context.eventByKey.get(`skill:${toolId}`)
  if (skillEvent?.type === 'skill_load') {
    skillEvent.status = normalizeStatus(data.status)
    return
  }

  if (toolName === 'run_script') {
    const scriptEvent = context.eventByKey.get(`script:${taskId}:${toolId}`)
    if (scriptEvent?.type === 'script_log')
      scriptEvent.status = normalizeStatus(data.status)
    return
  }

  const toolEvent = context.eventByKey.get(`tool:${taskId}:${toolId}`)
  if (toolEvent?.type === 'tool_call')
    toolEvent.status = normalizeStatus(data.status)
}

function updateTimestamps(context: ProcessBuildContext, timestamp?: number) {
  if (!timestamp)
    return

  context.firstTimestamp = context.firstTimestamp === undefined ? timestamp : Math.min(context.firstTimestamp, timestamp)
  context.lastTimestamp = context.lastTimestamp === undefined ? timestamp : Math.max(context.lastTimestamp, timestamp)
}

function finalizeProcessEvents(events: AgentProcessEvent[], failed: boolean) {
  for (const event of events) {
    if (event.status === 'running')
      event.status = failed ? 'failed' : 'success'

    if (event.type === 'parallel_dispatch')
      finalizeProcessEvents(event.tasks, failed)

    if (event.type === 'worker_task')
      finalizeProcessEvents(event.events, failed)
  }
}

interface OpenFragment {
  sequences: Set<number>
  type: 'thinking_delta' | 'content_delta'
}

function runEventScope(item: AgentConversationRunEventDTO): string {
  return 'workerId' in item.event.data && item.event.data.workerId ? item.event.data.workerId : ''
}

function runFragmentKey(item: AgentConversationRunEventDTO): string | undefined {
  const scope = runEventScope(item)
  if (item.event.type === 'thinking_delta')
    return `${scope}:thinking:${item.event.data.thinkingId}`
  if (item.event.type === 'content_delta')
    return `${scope}:content:${item.event.data.contentId}:${item.event.data.phase ?? ''}`
}

function thinkingFragmentKey(item: AgentConversationRunEventDTO): string | undefined {
  if (item.event.type !== 'thinking_completed')
    return undefined
  return `${runEventScope(item)}:thinking:${item.event.data.thinkingId}`
}

function visibleRunEvents(events: AgentConversationRunEventDTO[]): AgentConversationRunEventDTO[] {
  const sorted = [...events].sort((a, b) => a.sequence - b.sequence)
  const openByScope = new Map<string, Map<string, OpenFragment>>()
  const retryByScope = new Map<string, Map<string, OpenFragment>>()
  const retriedScopes = new Set<string>()
  const rolledBackSequences = new Set<number>()

  const scopeFragments = (source: Map<string, Map<string, OpenFragment>>, scope: string) => {
    let fragments = source.get(scope)
    if (!fragments) {
      fragments = new Map()
      source.set(scope, fragments)
    }
    return fragments
  }
  const rollbackFragments = (fragments?: Map<string, OpenFragment>) => {
    if (!fragments)
      return
    for (const fragment of fragments.values()) {
      for (const sequence of fragment.sequences)
        rolledBackSequences.add(sequence)
    }
  }
  const rollbackRetry = (scope: string) => {
    rollbackFragments(retryByScope.get(scope))
    retryByScope.delete(scope)
  }
  const rollbackOpen = (scope: string) => {
    rollbackFragments(openByScope.get(scope))
    openByScope.delete(scope)
  }
  const rollbackAll = () => {
    for (const fragments of retryByScope.values())
      rollbackFragments(fragments)
    for (const fragments of openByScope.values())
      rollbackFragments(fragments)
    retryByScope.clear()
    openByScope.clear()
  }
  const closeScope = (scope: string) => {
    openByScope.delete(scope)
  }
  const closeAll = () => {
    openByScope.clear()
  }
  const moveOpenToRetry = (scope: string) => {
    const open = openByScope.get(scope)
    if (!open)
      return
    const retry = scopeFragments(retryByScope, scope)
    for (const [key, fragment] of open) {
      const existing = retry.get(key)
      if (existing) {
        for (const sequence of fragment.sequences)
          existing.sequences.add(sequence)
      }
      else {
        retry.set(key, fragment)
      }
    }
    openByScope.delete(scope)
  }

  for (const item of sorted) {
    const event = item.event
    const scope = runEventScope(item)
    const fragmentKey = runFragmentKey(item)
    if (fragmentKey && (event.type === 'thinking_delta' || event.type === 'content_delta')) {
      rollbackRetry(scope)
      const open = scopeFragments(openByScope, scope)
      const oppositeType = event.type === 'thinking_delta' ? 'content_delta' : 'thinking_delta'
      for (const [key, fragment] of open) {
        if (fragment.type === oppositeType)
          open.delete(key)
      }
      const fragment = open.get(fragmentKey) ?? { sequences: new Set<number>(), type: event.type }
      fragment.sequences.add(item.sequence)
      open.set(fragmentKey, fragment)
      continue
    }

    if (event.type === 'run_retrying') {
      retriedScopes.add(scope)
      moveOpenToRetry(scope)
      continue
    }

    const completedThinkingKey = thinkingFragmentKey(item)
    if (completedThinkingKey) {
      const openThinking = openByScope.get(scope)?.get(completedThinkingKey)
      if (openThinking) {
        openThinking.sequences.add(item.sequence)
        continue
      }
      const retryThinking = retryByScope.get(scope)?.get(completedThinkingKey)
      if (retryThinking) {
        retryThinking.sequences.add(item.sequence)
        continue
      }
    }

    if (event.type === 'run_completed') {
      for (const retryScope of [...retryByScope.keys()])
        rollbackRetry(retryScope)
      closeAll()
      retriedScopes.clear()
      continue
    }

    if (event.type === 'run_failed') {
      if (event.data.code === 'network_interrupted')
        rollbackAll()
      else
        closeAll()
      retriedScopes.clear()
      continue
    }

    if (event.type === 'run_cancelled') {
      if (event.data.reason === 'user')
        closeAll()
      else
        rollbackAll()
      retriedScopes.clear()
      continue
    }

    if (
      event.type === 'worker_completed'
      && event.data.status !== 'success'
      && event.data.status !== 'cancelled'
      && retriedScopes.has(scope)
    ) {
      rollbackRetry(scope)
      rollbackOpen(scope)
    }
    else {
      rollbackRetry(scope)
      closeScope(scope)
    }
    retriedScopes.delete(scope)
  }

  return sorted.filter(item => !rolledBackSequences.has(item.sequence))
}

export function buildProcessFromEvents(
  messageId: string,
  events: AgentConversationRunEventDTO[],
  options: { finalize?: boolean } = {},
): { content: string, completedAt: string, process: AgentConversationProcess, status: AgentMessage['status'], errorData?: AgentErrorData | string } {
  const context: ProcessBuildContext = {
    rootEvents: [],
    eventByKey: new Map(),
    workerByTaskId: new Map(),
  }

  for (const item of visibleRunEvents(events)) {
    const event = item.event
    const rawData = event.data
    const data = asRecord(rawData)
    updateTimestamps(context, item.timestamp)
    const workerId = asString(data.workerId)

    switch (event.type) {
      case 'thinking_delta': {
        const thinkingId = asString(data.thinkingId) || 'main'
        const targetEvents = workerId ? ensureWorkerTask(context, workerId).events : context.rootEvents
        const key = workerId ? `worker:${workerId}:thinking:${thinkingId}` : `thinking:${thinkingId}`
        const thinking = getOrCreateThinking(targetEvents, context.eventByKey, key, `${workerId ? `worker-${workerId}-` : ''}thinking-${thinkingId}`)
        thinking.content += asString(data.text)
        break
      }

      case 'thinking_completed':
        markThinkingComplete(context, asString(data.thinkingId), workerId)
        break

      case 'content_delta': {
        const contentId = asString(data.contentId) || `content-${context.eventByKey.size}`
        if (data.phase === 'synthesis' && !workerId) {
          appendFinalAnswer(context, asString(data.text))
          break
        }

        const targetEvents = workerId ? ensureWorkerTask(context, workerId).events : context.rootEvents
        const key = workerId ? `worker:${workerId}:content:${contentId}` : `content:${contentId}`
        const content = getOrCreateContent(targetEvents, context.eventByKey, key, `${workerId ? `worker-${workerId}-` : ''}content-${contentId}`, Boolean(workerId))
        content.content += asString(data.text)
        break
      }

      case 'tool_started':
        handleToolCall(context, {
          ...data,
          args: data.input,
          taskId: data.workerId,
        })
        break

      case 'tool_finished':
        handleToolResult(context, {
          ...data,
          result: data.output,
          et: data.durationMs,
          taskId: data.workerId,
        })
        break

      case 'worker_dispatched':
        ensureWorkerTask(context, workerId || `worker-${context.workerByTaskId.size}`, asString(data.title))
        break

      case 'worker_completed':
        if (workerId)
          ensureWorkerTask(context, workerId).status = data.status === 'success' ? 'success' : 'failed'
        break

      case 'run_completed':
        if (asString(data.finalAnswer))
          appendFinalAnswer(context, asString(data.finalAnswer))
        context.endStatus = 'completed'
        break

      case 'run_failed': {
        const errorData = data
        if (isAgentCancelledError(errorData)) {
          context.endStatus = 'cancelled'
          break
        }

        context.endStatus = 'failed'
        context.errorData = errorData
        context.errorMessage = resolveAgentError(context.errorData).message
        break
      }

      case 'run_cancelled':
        context.endStatus = 'cancelled'
        if (context.parallelDispatch)
          context.parallelDispatch.status = 'failed'
        break

      case 'script_output':
        appendScriptLog(context, data)
        break

      case 'artifact_created':
        appendAgentFile(context, { ...data, op: data.operation })
        break
    }
  }

  if (!context.finalAnswer?.content.trim() && context.errorMessage)
    appendFinalAnswer(context, context.errorMessage)

  const failed = context.endStatus === 'failed'
  const completed = context.endStatus === 'completed'
  const terminal = context.endStatus !== undefined
  if (options.finalize !== false && completed)
    promoteLastRootContentToFinalAnswer(context)

  if (options.finalize !== false && terminal)
    finalizeProcessEvents(context.rootEvents, failed)

  const finalAnswer = context.finalAnswer?.content || ''
  const durationMs = context.firstTimestamp !== undefined && context.lastTimestamp !== undefined
    ? Math.max(0, context.lastTimestamp - context.firstTimestamp)
    : undefined
  const completedAt = terminal ? formatTime(context.lastTimestamp) : ''

  return {
    content: finalAnswer,
    completedAt,
    process: {
      id: `history-process-${messageId}`,
      completed,
      durationLabel: durationMs !== undefined ? formatDuration(durationMs) : undefined,
      durationState: terminal ? undefined : 'thinking',
      durationStartedAt: context.firstTimestamp,
      durationEndedAt: terminal ? context.lastTimestamp : undefined,
      collapsed: completed,
      events: context.rootEvents,
    },
    status: failed ? 'error' : (terminal ? 'done' : 'streaming'),
    errorData: context.errorData,
  }
}

function mapAssistantMessage(conversationId: string, message: AgentConsoleConversationMessageDTO, index: number): AgentMessage {
  const messageId = message.id || `${conversationId}-assistant-${index}`
  const rawContent = message.content ?? ''
  const events = message.events ?? []

  if (events.length > 0) {
    const parsed = buildProcessFromEvents(messageId, events, { finalize: true })
    return {
      id: messageId,
      conversationId,
      runId: events[0]?.runId ?? `history-run-${messageId}`,
      role: 'assistant',
      author: 'Roxy AI Agent',
      content: parsed.content,
      createdAt: parsed.completedAt || formatTime(message.createdAt),
      status: parsed.status,
      process: parsed.process,
      errorData: parsed.errorData,
    }
  }

  return {
    id: messageId,
    conversationId,
    runId: `history-run-${messageId}`,
    role: 'assistant',
    author: 'Roxy AI Agent',
    content: rawContent,
    createdAt: formatTime(message.createdAt),
    status: 'done',
  }
}

function mapMessageAttachments(message: AgentConsoleConversationMessageDTO): AgentAttachment[] | undefined {
  const attachments = message.metadata?.attachments
  if (!Array.isArray(attachments) || attachments.length === 0)
    return undefined

  return attachments.map(attachment => ({
    fileId: attachment.fileId,
    kind: 'file',
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    url: attachment.url,
    localUrl: attachment.localUrl,
    remoteUrl: attachment.remoteUrl,
    fileUrl: attachment.fileUrl,
    uploadStatus: 'uploaded',
  }))
}

export function mapHistoryConversation(dto: AgentConsoleConversationDTO): AgentConversation {
  return {
    id: dto.id,
    title: dto.title?.trim() || 'New conversation',
    updatedAt: formatTime(dto.updatedAt || dto.createdAt),
    latestRunId: dto.latestRunId,
    latestRunStatus: dto.latestRunStatus,
    runningRunIds: [],
    unread: dto.unread,
  }
}

export function mapHistoryMessages(detail: AgentConsoleConversationDetailDTO): AgentMessage[] {
  const conversationId = detail.conversation.id

  return (detail.messages ?? [])
    .filter(message => message.role !== 'system')
    .map((message, index): AgentMessage => {
      if (message.role === 'assistant')
        return mapAssistantMessage(conversationId, message, index)

      return {
        id: message.id || `${conversationId}-user-${index}`,
        conversationId,
        role: 'user',
        author: 'You',
        content: message.content ?? '',
        attachments: mapMessageAttachments(message),
        createdAt: formatTime(message.createdAt),
        status: 'done',
      }
    })
}
