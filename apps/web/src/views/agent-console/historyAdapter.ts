import type {
  AgentAttachment,
  AgentClarificationQuestion,
  AgentContentProcessEvent,
  AgentContextCompactedProcessEvent,
  AgentConversation,
  AgentConversationProcess,
  AgentFileArtifact,
  AgentFileProcessEvent,
  AgentFinalAnswerProcessEvent,
  AgentHitlProcessEvent,
  AgentLifecycleProcessEvent,
  AgentMessage,
  AgentProcessEvent,
  AgentProcessEventStatus,
  AgentRetryProcessEvent,
  AgentScriptLogProcessEvent,
  AgentSkillLoadProcessEvent,
  AgentTaskReportProcessEvent,
  AgentThinkingProcessEvent,
  AgentToolCallProcessEvent,
} from './types'
import type { AgentConsoleConversationDetailDTO, AgentConsoleConversationDTO, AgentConsoleConversationMessageDTO } from './api'
import type { TaskReportInput } from '@roxy/shared'
import type { AgentConversationRunEventDTO } from '@roxy/shared/channel'
import { TaskReportInputSchema } from '@roxy/shared'
import type { AgentErrorData } from './utils/agent-error'
import { toRaw } from 'vue'
import { getMemoryToolPresentation } from './memoryToolPresentation'
import { isAgentCancelledError, resolveAgentError } from './utils/agent-error'

export interface ProcessBuildContext {
  conversationId: string
  runId: string
  currentConversationId?: string
  currentRunId?: string
  rootEvents: AgentProcessEvent[]
  eventByKey: Map<string, AgentProcessEvent>
  activeRetriesByScope: Map<string, AgentRetryProcessEvent>
  agentByPath: Map<string, AgentLifecycleProcessEvent>
  hitlByApprovalId: Map<string, AgentHitlProcessEvent>
  pendingTaskReports: Map<string, { sourceReportId: string, report: TaskReportInput }>
  finalAnswer?: AgentFinalAnswerProcessEvent
  firstTimestamp?: number
  lastTimestamp?: number
  endStatus?: 'completed' | 'failed' | 'cancelled'
  errorMessage?: string
  errorData?: AgentErrorData | string
}

export interface ProcessBuildCheckpoint {
  context: ProcessBuildContext
  eventCount: number
  lastEvent?: AgentConversationRunEventDTO
  lastSequence?: number
  replayUnsafe: boolean
}

export interface ProcessBuildResult {
  content: string
  completedAt: string
  process: AgentConversationProcess
  status: AgentMessage['status']
  errorData?: AgentErrorData | string
  checkpoint: ProcessBuildCheckpoint
}

function lifecycleProcessStatus(status: AgentLifecycleProcessEvent['lifecycleStatus']): AgentProcessEventStatus {
  if (status === 'starting' || status === 'running') {
    return 'running'
  }
  return status === 'completed' ? 'success' : 'failed'
}

function lifecycleTitle(agentName: string, status: AgentLifecycleProcessEvent['lifecycleStatus']): string {
  const labels = {
    starting: '正在创建',
    running: '正在执行',
    completed: '已完成',
    failed: '执行失败',
    cancelled: '已取消',
  } as const
  return `${labels[status]} ${agentName}`
}

function ensureAgentLifecycleNode(
  context: ProcessBuildContext,
  agentPath: string,
  data: Record<string, unknown> = {},
): AgentLifecycleProcessEvent {
  const lifecycleKey = `${context.currentConversationId ?? context.conversationId}:${context.currentRunId ?? context.runId}:${agentPath}`
  const existing = context.agentByPath.get(lifecycleKey)
  if (existing) {
    return existing
  }

  const parentAgentPath = asString(data.parentAgentPath) || agentPath.split('/').slice(0, -1).join('/') || undefined
  const agentName = asString(data.agentName) || agentPath.split('/').at(-1) || agentPath
  const lifecycleStatus = (asString(data.status) || 'starting') as AgentLifecycleProcessEvent['lifecycleStatus']
  const event: AgentLifecycleProcessEvent = {
    id: `agent-${agentPath}`,
    type: 'agent_lifecycle',
    agentPath,
    parentAgentPath,
    agentName,
    agentType: asString(data.agentType) || 'agent',
    lifecycleStatus,
    title: lifecycleTitle(agentName, lifecycleStatus),
    status: lifecycleProcessStatus(lifecycleStatus),
    expanded: false,
    startedAt: asNumber(data.startedAt),
    finishedAt: asNumber(data.finishedAt),
    report: asString(data.report) || undefined,
    error: asString(data.error) || undefined,
    events: [],
    children: [],
  }
  context.agentByPath.set(lifecycleKey, event)

  if (parentAgentPath && parentAgentPath !== '/root') {
    const parent = ensureAgentLifecycleNode(context, parentAgentPath)
    parent.children.push(event)
  }
  else if (agentPath !== '/root') {
    context.rootEvents.push(event)
  }
  return event
}

function agentPathFromData(data: Record<string, unknown>): string {
  const path = asString(data.agentPath)
  return path === '/root' || !path ? '/root' : path
}

function eventScope(context: ProcessBuildContext, data: Record<string, unknown>): string {
  return `${context.currentConversationId ?? context.conversationId}:${context.currentRunId ?? context.runId}:${agentPathFromData(data)}`
}

function scopedEventId(context: ProcessBuildContext, data: Record<string, unknown>, kind: string, id: string): string {
  const agentPath = agentPathFromData(data)
  return agentPath === '/root' ? `${kind}-${id}` : `${kind}-${eventScope(context, data)}-${id}`
}

function agentEventsFor(context: ProcessBuildContext, data: Record<string, unknown>): AgentProcessEvent[] {
  const agentPath = agentPathFromData(data)
  return agentPath === '/root' ? context.rootEvents : ensureAgentLifecycleNode(context, agentPath, data).events
}

function updateAgentLifecycle(context: ProcessBuildContext, data: Record<string, unknown>) {
  const agentPath = asString(data.agentPath)
  if (!agentPath) {
    return
  }

  const event = ensureAgentLifecycleNode(context, agentPath, data)
  const lifecycleStatus = asString(data.status) as AgentLifecycleProcessEvent['lifecycleStatus']
  event.parentAgentPath = asString(data.parentAgentPath) || event.parentAgentPath
  event.agentName = asString(data.agentName) || event.agentName
  event.agentType = asString(data.agentType) || event.agentType
  event.lifecycleStatus = lifecycleStatus
  event.title = lifecycleTitle(event.agentName, lifecycleStatus)
  event.status = lifecycleProcessStatus(lifecycleStatus)
  event.startedAt = asNumber(data.startedAt) ?? event.startedAt
  event.finishedAt = asNumber(data.finishedAt) ?? event.finishedAt
  event.report = asString(data.report) || event.report
  event.error = asString(data.error) || event.error
}

function markAgentLifecycleRevision(
  context: ProcessBuildContext,
  agentPath: string,
  data: Record<string, unknown>,
  sequence: number,
): void {
  if (agentPath === '/root') {
    return
  }

  let currentPath: string | undefined = agentPath
  let currentData = data
  while (currentPath && currentPath !== '/root') {
    const event = ensureAgentLifecycleNode(context, currentPath, currentData)
    event.renderRevision = Math.max(event.renderRevision ?? 0, sequence)
    currentPath = event.parentAgentPath
    currentData = {}
  }
}

function mergeSpawnAgentLifecycleGroups(
  events: AgentProcessEvent[],
  childLifecycles: AgentLifecycleProcessEvent[] = [],
): { events: AgentProcessEvent[], remainingChildren: AgentLifecycleProcessEvent[] } {
  const lifecycles = [
    ...events.filter((event): event is AgentLifecycleProcessEvent => event.type === 'agent_lifecycle'),
    ...childLifecycles,
  ]
  const unmatched = [...lifecycles]
  const lifecycleBySpawnId = new Map<string, AgentLifecycleProcessEvent>()
  for (const event of events) {
    if (event.type !== 'tool_call' || (event.toolName !== 'spawn_agent' && !event.toolName.endsWith('__spawn_agent'))) {
      continue
    }

    const input = asRecord(event.input)
    const requestedName = asString(input.name) || asString(input.taskName)
    const matchIndex = requestedName
      ? unmatched.findIndex(lifecycle => lifecycle.agentName === requestedName)
      : (unmatched.length > 0 ? 0 : -1)
    if (matchIndex < 0) {
      continue
    }

    lifecycleBySpawnId.set(event.id, unmatched.splice(matchIndex, 1)[0])
  }
  const matchedLifecycles = new Set(lifecycleBySpawnId.values())
  const merged = events.flatMap((event) => {
    const replacement = lifecycleBySpawnId.get(event.id)
    if (replacement) {
      return [replacement]
    }
    if (event.type === 'agent_lifecycle' && matchedLifecycles.has(event)) {
      return []
    }
    return [event]
  })

  for (const lifecycle of lifecycles) {
    const nested = mergeSpawnAgentLifecycleGroups(lifecycle.events, lifecycle.children)
    lifecycle.events = nested.events
    lifecycle.children = nested.remainingChildren
  }
  return {
    events: merged,
    remainingChildren: childLifecycles.filter(lifecycle => !matchedLifecycles.has(lifecycle)),
  }
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

function parseSerializedToolInput(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }
  try {
    return JSON.parse(value) as unknown
  }
  catch {
    return value
  }
}

function parseTaskReportInput(value: unknown): TaskReportInput | undefined {
  const parsed = TaskReportInputSchema.safeParse(parseSerializedToolInput(value))
  return parsed.success ? parsed.data : undefined
}

export function formatTime(value?: string | number) {
  if (!value) {
    return ''
  }

  const date = new Date(typeof value === 'number' && value < 10000000000 ? value * 1000 : value)
  if (Number.isNaN(date.getTime())) {
    return `${value}`
  }

  const pad = (n: number) => `${n}`.padStart(2, '0')
  const now = new Date()
  const sameYear = date.getFullYear() === now.getFullYear()
  const datePart = sameYear
    ? `${pad(date.getMonth() + 1)}/${pad(date.getDate())}`
    : `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`

  return `${datePart} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatDuration(ms: number) {
  if (ms < 1000) {
    return `${$t('任务耗时')} 1s`
  }

  const seconds = Math.round(ms / 1000)
  if (seconds < 60) {
    return `${$t('任务耗时')} ${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const restSeconds = seconds % 60
  return restSeconds > 0 ? `${$t('任务耗时')} ${minutes}m${restSeconds}s` : `${$t('任务耗时')} ${minutes}m`
}

export function formatThinkingDuration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000))
  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const restSeconds = seconds % 60
  return restSeconds > 0 ? `${minutes}m${restSeconds}s` : `${minutes}m`
}

function normalizeStatus(value: unknown): AgentProcessEventStatus {
  if (value === 'pending' || value === 'running' || value === 'success' || value === 'failed') {
    return value
  }

  return value === 'error' || value === 'cancelled' ? 'failed' : 'success'
}

function getOrCreateThinking(
  targetEvents: AgentProcessEvent[],
  eventByKey: Map<string, AgentProcessEvent>,
  key: string,
  id: string,
): AgentThinkingProcessEvent {
  const existing = eventByKey.get(key)
  if (existing?.type === 'thinking') {
    return existing
  }

  const event: AgentThinkingProcessEvent = {
    id,
    type: 'thinking',
    title: $t('正在思考'),
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
  if (existing?.type === 'content') {
    return existing
  }

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
  if (existing?.type === 'tool_call') {
    return existing
  }

  const toolName = asString(data.toolName) || 'tool'
  const event: AgentToolCallProcessEvent = {
    id,
    type: 'tool_call',
    toolName,
    finished: false,
    target: asString(data.target),
    patchType: data.patchType === 'create' || data.patchType === 'update' || data.patchType === 'delete' || data.patchType === 'mixed'
      ? data.patchType
      : undefined,
    input: data.input,
    status: 'running',
  }
  eventByKey.set(key, event)
  targetEvents.push(event)
  return event
}

function getOrCreateTaskReport(
  targetEvents: AgentProcessEvent[],
  eventByKey: Map<string, AgentProcessEvent>,
  key: string,
  id: string,
  sourceReportId: string,
  report: TaskReportInput,
): AgentTaskReportProcessEvent {
  const existing = eventByKey.get(key)
  if (existing?.type === 'task_report') {
    return existing
  }

  const event: AgentTaskReportProcessEvent = {
    id,
    type: 'task_report',
    sourceReportId,
    report,
    status: 'success',
  }
  eventByKey.set(key, event)
  targetEvents.push(event)
  return event
}

function isLocalAbsolutePath(value: string): boolean {
  return value.startsWith('/')
    || /^[a-z]:[\\/]/i.test(value)
    || value.startsWith('\\\\')
}

function pathBasename(value: string): string {
  return value.split(/[\\/]/).filter(Boolean).at(-1) || value
}

function scriptDisplayName(scriptName: string): string {
  return isLocalAbsolutePath(scriptName) ? pathBasename(scriptName) : scriptName
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
      existing.title = `${$t('运行脚本')} ${scriptDisplayName(scriptName)}`
    }
    return existing
  }

  const scriptName = asString(data.scriptName)
  const toolId = asString(data.toolId) || undefined
  const scriptRunId = asString(data.scriptRunId) || undefined
  const dirId = asString(data.dirId) || undefined
  const event: AgentScriptLogProcessEvent = {
    id,
    type: 'script_log',
    title: scriptName ? `${$t('运行脚本')} ${scriptDisplayName(scriptName)}` : $t('运行脚本'),
    expanded: false,
    status: 'running',
    toolId,
    scriptRunId,
    dirId,
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
  if (existing?.type === 'agent_file') {
    return existing
  }

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

function isClarificationRequest(data: Record<string, unknown>): boolean {
  return data.requestKind === 'clarification'
}

function hitlTitle(data: Record<string, unknown>, resolved = false): string {
  if (isClarificationRequest(data)) {
    const count = Array.isArray(data.questions) && data.questions.length > 0 ? data.questions.length : 1
    return resolved ? $t('已询问 {n} 个问题', { n: count }) : $t('正在询问 {n} 个问题', { n: count })
  }

  if (resolved) {
    return asString(data.title) || $t('审批已处理')
  }

  return asString(data.title) || $t('请求批准')
}

function splitHitlOptionLabel(label: string): { title: string, description: string } {
  const [title, ...descriptionParts] = label.split(/[:：]/)
  return {
    title: title.trim() || label,
    description: descriptionParts.join('：').trim(),
  }
}

function getHitlControlOptionTitle(value: unknown): string {
  if (!Array.isArray(value)) {
    return ''
  }

  const choice = value
    .map(asRecord)
    .find(control => asString(control.kind) === 'choice' && asString(control.id) === 'answer')
    ?? value.map(asRecord).find(control => asString(control.kind) === 'choice')
  const options = Array.isArray(choice?.options) ? choice.options.map(asRecord) : []
  const recommended = options.find(option => asString(option.label).includes('推荐')) ?? options[0]
  return recommended ? splitHitlOptionLabel(asString(recommended.label)).title : ''
}

function hitlDetail(data: Record<string, unknown>): string | undefined {
  const description = asString(data.description)
  if (description) {
    return description
  }

  if (isClarificationRequest(data)) {
    return undefined
  }

  const optionTitle = getHitlControlOptionTitle(data.controls)
  if (optionTitle) {
    return optionTitle
  }

  return undefined
}

function clarificationQuestionsFromData(data: Record<string, unknown>): AgentClarificationQuestion[] | undefined {
  if (!Array.isArray(data.questions)) {
    return undefined
  }

  const questions = data.questions
    .map(asRecord)
    .map((question): AgentClarificationQuestion | undefined => {
      const id = asString(question.id)
      const header = asString(question.header)
      const prompt = asString(question.question)
      const options = Array.isArray(question.options)
        ? question.options
            .map(asRecord)
            .map((option) => {
              const label = asString(option.label)
              const description = asString(option.description)
              return label ? { label, description } : undefined
            })
            .filter((option): option is AgentClarificationQuestion['options'][number] => Boolean(option))
        : []

      return id && prompt ? { id, header, question: prompt, options } : undefined
    })
    .filter((question): question is AgentClarificationQuestion => Boolean(question))

  return questions.length > 0 ? questions : undefined
}

function parseClarificationAnswerRecord(value: string): Record<string, string> | undefined {
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, answer]) => typeof answer === 'string')
        .map(([key, answer]) => [key, (answer as string).trim()]),
    )
  }
  catch {
    return undefined
  }
}

function resolvedClarificationAnswer(
  data: Record<string, unknown>,
  questions?: AgentClarificationQuestion[],
): Pick<AgentHitlProcessEvent, 'detail' | 'clarificationAnswers'> | undefined {
  const decisions = Array.isArray(data.decisions) ? data.decisions.map(asRecord) : []
  for (const decision of decisions) {
    if (asString(decision.type) === 'answer') {
      const answer = asString(decision.answer).trim()
      if (!questions?.length) {
        return { detail: answer || $t('已跳过') }
      }

      const answerRecord = parseClarificationAnswerRecord(answer)
      if (!answerRecord) {
        return { detail: answer || $t('已跳过') }
      }

      return {
        clarificationAnswers: questions.map((question) => {
          const answerValue = answerRecord[question.id] || ''
          return {
            id: question.id,
            question: question.question,
            answer: answerValue || $t('未提供答案'),
            recommended: Boolean(answerValue && question.options[0]?.label === answerValue),
          }
        }),
      }
    }
  }
  return undefined
}

function getOrCreateHitl(
  context: ProcessBuildContext,
  targetEvents: AgentProcessEvent[],
  scope: string,
  approvalId: string,
  data: Record<string, unknown>,
): AgentHitlProcessEvent {
  const existing = context.hitlByApprovalId.get(approvalId)
  const clarificationQuestions = clarificationQuestionsFromData(data)
  const clarificationQuestionCount = clarificationQuestions?.length
  if (existing) {
    existing.title = hitlTitle(data)
    existing.prompt = asString(data.prompt) || existing.prompt
    existing.description = asString(data.description) || existing.description
    existing.detail = hitlDetail(data) || existing.detail
    existing.requestKind = isClarificationRequest(data) ? 'clarification' : 'approval'
    existing.clarificationQuestionCount = clarificationQuestionCount ?? existing.clarificationQuestionCount
    existing.clarificationQuestions = clarificationQuestions ?? existing.clarificationQuestions
    existing.status = 'running'
    return existing
  }

  const event: AgentHitlProcessEvent = {
    id: `hitl-${scope}-${approvalId}`,
    type: 'hitl',
    title: hitlTitle(data),
    prompt: asString(data.prompt) || $t('RoxyAgent 需要您的输入才能继续'),
    description: asString(data.description) || undefined,
    detail: hitlDetail(data),
    requestKind: isClarificationRequest(data) ? 'clarification' : 'approval',
    clarificationQuestionCount,
    clarificationQuestions,
    approvalId,
    status: 'running',
    expanded: true,
  }
  context.hitlByApprovalId.set(approvalId, event)
  targetEvents.push(event)
  return event
}

function resolveHitl(context: ProcessBuildContext, data: Record<string, unknown>, timestamp?: number) {
  const approvalId = asString(data.approvalId)
  const event = approvalId ? context.hitlByApprovalId.get(approvalId) : undefined
  if (!event) {
    return
  }

  const answer = event.requestKind === 'clarification'
    ? resolvedClarificationAnswer(data, event.clarificationQuestions)
    : undefined
  event.status = 'success'
  event.title = event.requestKind === 'clarification'
    ? $t('已询问 {n} 个问题', { n: event.clarificationQuestionCount ?? 1 })
    : hitlTitle({ ...data, requestKind: event.requestKind }, true)
  event.detail = answer?.detail ?? event.detail
  event.clarificationAnswers = answer?.clarificationAnswers ?? event.clarificationAnswers
  event.timestamp = formatTime(timestamp)
}

function retryTitle(
  data: Pick<AgentRetryProcessEvent, 'attempt' | 'maxAttempts'> | Record<string, unknown>,
  status: AgentProcessEventStatus = 'running',
): string {
  if (status === 'success') {
    return $t('已重新连接')
  }
  if (status === 'failed') {
    return $t('网络重试失败')
  }
  const attempt = asNumber(data.attempt) ?? 0
  const maxAttempts = asNumber(data.maxAttempts) ?? 0
  return $t('正在重新连接 {attempt}/{maxAttempts}', { attempt, maxAttempts })
}

function getOrCreateRetry(
  context: ProcessBuildContext,
  targetEvents: AgentProcessEvent[],
  scope: string,
  key: string,
  id: string,
  data: Record<string, unknown>,
): AgentRetryProcessEvent {
  const existing = context.eventByKey.get(key)
  if (existing?.type === 'retrying') {
    existing.attempt = asNumber(data.attempt) ?? existing.attempt
    existing.maxAttempts = asNumber(data.maxAttempts) ?? existing.maxAttempts
    existing.reason = asString(data.reason) || existing.reason
    existing.status = 'running'
    existing.title = retryTitle(data)
    context.activeRetriesByScope.set(scope, existing)
    return existing
  }

  const event: AgentRetryProcessEvent = {
    id,
    type: 'retrying',
    title: retryTitle(data),
    attempt: asNumber(data.attempt) ?? 0,
    maxAttempts: asNumber(data.maxAttempts) ?? 0,
    reason: asString(data.reason) || undefined,
    status: 'running',
    timestamp: undefined,
  }
  context.eventByKey.set(key, event)
  context.activeRetriesByScope.set(scope, event)
  targetEvents.push(event)
  return event
}

function settleRetry(context: ProcessBuildContext, scope: string, status: 'success' | 'failed') {
  const retry = context.activeRetriesByScope.get(scope)
  if (!retry) {
    return
  }
  retry.status = status
  retry.title = retryTitle(retry, status)
  context.activeRetriesByScope.delete(scope)
}

function appendScriptLog(context: ProcessBuildContext, data: Record<string, unknown>) {
  const scope = eventScope(context, data)
  const toolId = asString(data.toolId)
  const scriptRunId = asString(data.scriptRunId)
  const dirId = asString(data.dirId)
  const groupId = toolId || scriptRunId || asString(data.scriptName) || 'default'
  const windowId = dirId || scriptRunId
  const targetEvents = agentEventsFor(context, data)
  const placeholderKey = `script:${scope}:${groupId}`
  const windowKey = windowId ? `${placeholderKey}:${windowId}` : placeholderKey
  let event = context.eventByKey.get(windowKey)

  if (event?.type !== 'script_log') {
    const placeholder = context.eventByKey.get(placeholderKey)
    if (placeholder?.type === 'script_log' && !placeholder.dirId) {
      placeholder.toolId = toolId || placeholder.toolId
      placeholder.scriptRunId = scriptRunId || placeholder.scriptRunId
      placeholder.dirId = dirId || placeholder.dirId
      context.eventByKey.set(windowKey, placeholder)
      event = placeholder
    }
    else {
      event = getOrCreateScriptLog(
        context,
        targetEvents,
        windowKey,
        `script-log-${scope}-${groupId}-${windowId || 'default'}`,
        data,
      )
    }
  }

  if (event.type !== 'script_log') {
    return
  }

  const scriptName = asString(data.scriptName)
  if (scriptName && event.scriptName !== scriptName) {
    event.scriptName = scriptName
    event.title = `${$t('运行脚本')} ${scriptDisplayName(scriptName)}`
  }
  event.toolId = toolId || event.toolId
  event.scriptRunId = scriptRunId || event.scriptRunId
  event.dirId = dirId || event.dirId
  const message = data.unavailableReason === 'file_missing'
    ? $t('（脚本日志文件不存在）')
    : asString(data.message) || asString(data.text)
  if (!message) {
    return
  }

  event.lines.push({
    level: asString(data.level) || 'info',
    message,
  })
}

function appendAgentFile(context: ProcessBuildContext, data: Record<string, unknown>) {
  const fileId = asString(data.fileId)
  const fileName = asString(data.fileName)
  if (!fileId || !fileName) {
    return
  }

  const files = getOrCreateAgentFiles(context)
  const item: AgentFileArtifact = {
    fileId,
    fileName,
    size: asNumber(data.size) ?? 0,
    mimeType: asString(data.mimeType) || 'application/octet-stream',
    op: data.op === 'update' ? 'update' : 'create',
  }
  const existingIndex = files.files.findIndex(file => file.fileId === item.fileId)
  if (existingIndex >= 0) {
    files.files[existingIndex] = item
  }
  else {
    files.files.push(item)
  }
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
  if (context.finalAnswer?.content.trim()) {
    return
  }

  for (let index = context.rootEvents.length - 1; index >= 0; index--) {
    const event = context.rootEvents[index]
    if (event.type !== 'content' || !event.content.trim()) {
      continue
    }

    context.finalAnswer = {
      id: 'final-answer',
      type: 'final_answer',
      content: event.content,
    }
    context.rootEvents.splice(index, 1, context.finalAnswer)
    return
  }
}

function completeFinalAnswer(context: ProcessBuildContext, content: string) {
  if (!context.finalAnswer) {
    promoteLastRootContentToFinalAnswer(context)
  }
  if (!context.finalAnswer) {
    appendFinalAnswer(context, content)
    return
  }

  context.finalAnswer.content = content
}

function markThinkingComplete(
  context: ProcessBuildContext,
  thinkingId: string,
  scope: string,
  data: Record<string, unknown>,
  receivedAt?: number,
) {
  const key = `${scope}:thinking:${thinkingId}`
  const event = context.eventByKey.get(key)
  if (event?.type !== 'thinking') {
    return
  }

  const frontendDurationMs = event.durationStartedAt !== undefined && receivedAt !== undefined
    ? Math.max(0, receivedAt - event.durationStartedAt)
    : undefined
  event.durationEndedAt = asNumber(data.endTimestamp) ?? receivedAt
  event.durationMs = asNumber(data.durationMs) ?? frontendDurationMs
  event.title = `${$t('已思考')} ${formatThinkingDuration(event.durationMs ?? 0)}`
  event.status = 'success'
}

function handleToolCall(context: ProcessBuildContext, data: Record<string, unknown>) {
  const toolName = asString(data.toolName) || 'tool'
  const toolId = asString(data.toolId) || `${toolName}-${context.eventByKey.size}`
  const scope = eventScope(context, data)
  const targetEvents = agentEventsFor(context, data)
  if (toolName === 'roxy_task_report') {
    const report = parseTaskReportInput(data.input ?? data.args)
    if (!report) {
      return
    }
    context.pendingTaskReports.set(`task-report:${scope}:${toolId}`, { sourceReportId: toolId, report })
    return
  }
  const memoryPresentation = getMemoryToolPresentation(toolName, data.input ?? data.args, {
    patchType: data.patchType === 'create' || data.patchType === 'update' || data.patchType === 'delete' || data.patchType === 'mixed'
      ? data.patchType
      : undefined,
    target: asString(data.target) || undefined,
  })
  if (memoryPresentation?.kind === 'hidden') {
    return
  }

  if (toolName === 'load_skill_file') {
    const skillPath = asString(data.skillFilePath) || asString(data.skillName) || 'skill'
    const event: AgentSkillLoadProcessEvent = {
      id: `skill-${scope}-${toolId}`,
      type: 'skill_load',
      skillPath,
      status: 'running',
    }

    context.eventByKey.set(`skill:${scope}:${toolId}`, event)
    targetEvents.push(event)
    return
  }

  if (toolName === 'roxy_script_run') {
    const rawInput = data.input ?? data.args
    const rawRecord = asRecord(rawInput)
    const inputs = Array.isArray(rawRecord.scripts)
      ? rawRecord.scripts.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
      : [rawRecord]
    const dirIds = [...new Set(inputs.flatMap(input =>
      Array.isArray(input.dirIds) ? input.dirIds.map(asString).filter(Boolean) : []))]
    if (dirIds.length > 0) {
      for (const dirId of dirIds) {
        getOrCreateScriptLog(
          context,
          targetEvents,
          `script:${scope}:${toolId}:${dirId}`,
          `script-log-${scope}-${toolId}-${dirId}`,
          { ...data, scriptName: asString(data.target), toolId, dirId },
        )
      }
      return
    }

    getOrCreateScriptLog(
      context,
      targetEvents,
      `script:${scope}:${toolId}`,
      `script-log-${scope}-${toolId}`,
      { ...data, scriptName: asString(data.target), toolId },
    )
    return
  }

  getOrCreateTool(targetEvents, context.eventByKey, `tool:${scope}:${toolId}`, `tool-${scope}-${toolId}`, data)
}

function handleToolResult(context: ProcessBuildContext, data: Record<string, unknown>) {
  const toolName = asString(data.toolName) || 'tool'
  const toolId = asString(data.toolId) || `${toolName}-${context.eventByKey.size}`
  const scope = eventScope(context, data)
  const taskReportKey = `task-report:${scope}:${toolId}`
  const pendingTaskReport = context.pendingTaskReports.get(taskReportKey)
  if (pendingTaskReport) {
    context.pendingTaskReports.delete(taskReportKey)
    if (data.status === 'success') {
      const taskReport = getOrCreateTaskReport(
        agentEventsFor(context, data),
        context.eventByKey,
        taskReportKey,
        `task-report-${scope}-${toolId}`,
        pendingTaskReport.sourceReportId,
        pendingTaskReport.report,
      )
      for (const event of agentEventsFor(context, data)) {
        if (event.type === 'task_report' && event !== taskReport) {
          event.superseded = true
        }
      }
    }
    return
  }
  const skillEvent = context.eventByKey.get(`skill:${scope}:${toolId}`)
  if (skillEvent?.type === 'skill_load') {
    skillEvent.status = normalizeStatus(data.status)
    return
  }

  if (toolName === 'roxy_script_run') {
    const status = normalizeStatus(data.status)
    const targetEvents = agentEventsFor(context, data)
    for (const event of new Set(context.eventByKey.values())) {
      if (event.type === 'script_log' && event.toolId === toolId && targetEvents.includes(event)) {
        event.status = status
      }
    }
    return
  }

  const toolEvent = context.eventByKey.get(`tool:${scope}:${toolId}`)
  if (toolEvent?.type === 'tool_call') {
    toolEvent.finished = true
    toolEvent.status = normalizeStatus(data.status)
    toolEvent.output = data.output
    toolEvent.durationMs = asNumber(data.durationMs)
  }
}

function updateTimestamps(context: ProcessBuildContext, timestamp?: number) {
  if (!timestamp) {
    return
  }

  context.firstTimestamp = context.firstTimestamp === undefined ? timestamp : Math.min(context.firstTimestamp, timestamp)
  context.lastTimestamp = context.lastTimestamp === undefined ? timestamp : Math.max(context.lastTimestamp, timestamp)
}

function finalizeProcessEvents(events: AgentProcessEvent[], failed: boolean) {
  for (const event of events) {
    if (event.status === 'running') {
      event.status = failed ? 'failed' : 'success'
    }

    if (event.type === 'agent_lifecycle') {
      finalizeProcessEvents(event.events, failed)
      event.children.forEach(child => finalizeProcessEvents([child], failed))
    }
  }
}

interface OpenFragment {
  sequences: Set<number>
  type: 'thinking_delta' | 'content_delta'
}

function runEventScope(item: AgentConversationRunEventDTO): string {
  const data = asRecord(item.event.data)
  return `${item.conversationId}:${item.runId}:${agentPathFromData(data)}`
}

function runFragmentKey(item: AgentConversationRunEventDTO): string | undefined {
  const scope = runEventScope(item)
  if (item.event.type === 'thinking_delta') {
    return `${scope}:thinking:${item.event.data.id ?? item.event.data.thinkingId}`
  }
  if (item.event.type === 'content_delta') {
    return `${scope}:content:${item.event.data.id ?? item.event.data.contentId}:${item.event.data.phase ?? ''}`
  }
}

function thinkingFragmentKey(item: AgentConversationRunEventDTO): string | undefined {
  if (item.event.type !== 'thinking_completed') {
    return undefined
  }
  return `${runEventScope(item)}:thinking:${item.event.data.id ?? item.event.data.thinkingId}`
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
    if (!fragments) {
      return
    }
    for (const fragment of fragments.values()) {
      for (const sequence of fragment.sequences) {
        rolledBackSequences.add(sequence)
      }
    }
  }
  const rollbackRetry = (scope: string) => {
    rollbackFragments(retryByScope.get(scope))
    retryByScope.delete(scope)
  }
  const rollbackAll = () => {
    for (const fragments of retryByScope.values()) {
      rollbackFragments(fragments)
    }
    for (const fragments of openByScope.values()) {
      rollbackFragments(fragments)
    }
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
    if (!open) {
      return
    }
    const retry = scopeFragments(retryByScope, scope)
    for (const [key, fragment] of open) {
      const existing = retry.get(key)
      if (existing) {
        for (const sequence of fragment.sequences) {
          existing.sequences.add(sequence)
        }
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
        if (fragment.type === oppositeType) {
          open.delete(key)
        }
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
      for (const retryScope of [...retryByScope.keys()]) {
        rollbackRetry(retryScope)
      }
      closeAll()
      retriedScopes.clear()
      continue
    }

    if (event.type === 'run_failed') {
      if (event.data.code === 'network_interrupted') {
        rollbackAll()
      }
      else {
        closeAll()
      }
      retriedScopes.clear()
      continue
    }

    if (event.type === 'run_cancelled') {
      if (event.data.reason === 'user') {
        closeAll()
      }
      else {
        rollbackAll()
      }
      retriedScopes.clear()
      continue
    }

    rollbackRetry(scope)
    closeScope(scope)
    retriedScopes.delete(scope)
  }

  return sorted.filter(item => !rolledBackSequences.has(item.sequence))
}

function createProcessBuildContext(messageId: string, events: AgentConversationRunEventDTO[]): ProcessBuildContext {
  return {
    conversationId: events[0]?.conversationId ?? messageId,
    runId: events[0]?.runId ?? messageId,
    rootEvents: [],
    eventByKey: new Map(),
    activeRetriesByScope: new Map(),
    agentByPath: new Map(),
    hitlByApprovalId: new Map(),
    pendingTaskReports: new Map(),
  }
}

function applyProcessRunEvent(context: ProcessBuildContext, item: AgentConversationRunEventDTO): void {
  const event = item.event
  const rawData = event.data
  const data = asRecord(rawData)
  context.currentConversationId = item.conversationId
  context.currentRunId = item.runId
  updateTimestamps(context, item.timestamp)
  const agentPath = agentPathFromData(data)
  const scope = eventScope(context, data)
  markAgentLifecycleRevision(context, agentPath, data, item.sequence)

  switch (event.type) {
    case 'agent_lifecycle':
      updateAgentLifecycle(context, data)
      break

    case 'run_retrying': {
      const retryId = asString(data.retryId) || `sequence-${item.sequence}`
      settleRetry(context, scope, 'success')
      const targetEvents = agentEventsFor(context, data)
      getOrCreateRetry(
        context,
        targetEvents,
        scope,
        `retry:${scope}:${retryId}`,
        `retry-${scope}-${retryId}`,
        data,
      ).timestamp = formatTime(item.timestamp)
      break
    }

    case 'thinking_delta': {
      settleRetry(context, scope, 'success')
      const thinkingId = asString(data.id) || asString(data.thinkingId) || 'main'
      const targetEvents = agentEventsFor(context, data)
      const key = `${scope}:thinking:${thinkingId}`
      const thinking = getOrCreateThinking(targetEvents, context.eventByKey, key, scopedEventId(context, data, 'thinking', thinkingId))
      thinking.durationStartedAt ??= item.timestamp
      thinking.content += asString(data.text)
      break
    }

    case 'thinking_completed':
      markThinkingComplete(context, asString(data.id) || asString(data.thinkingId), scope, data, item.timestamp)
      break

    case 'content_delta': {
      settleRetry(context, scope, 'success')
      const contentId = asString(data.id) || asString(data.contentId) || `content-${context.eventByKey.size}`
      if (data.phase === 'synthesis' && agentPath === '/root') {
        appendFinalAnswer(context, asString(data.text))
        break
      }

      const targetEvents = agentEventsFor(context, data)
      const key = `${scope}:content:${contentId}:${asString(data.phase)}`
      const content = getOrCreateContent(targetEvents, context.eventByKey, key, scopedEventId(context, data, 'content', contentId), agentPath !== '/root')
      content.content += asString(data.text)
      break
    }

    case 'tool_started':
      settleRetry(context, scope, 'success')
      handleToolCall(context, {
        ...data,
        args: data.input,
        agentPath,
      })
      break

    case 'tool_finished':
      handleToolResult(context, {
        ...data,
        result: data.output,
        et: data.durationMs,
        agentPath,
      })
      break

    case 'approval_requested': {
      const approvalId = asString(data.approvalId) || asString(data.interruptsId) || `sequence-${item.sequence}`
      const targetEvents = agentEventsFor(context, data)
      const hitl = getOrCreateHitl(context, targetEvents, scope, approvalId, data)
      hitl.timestamp = formatTime(item.timestamp)
      break
    }

    case 'approval_resolved':
      resolveHitl(context, data, item.timestamp)
      break

    case 'run_completed':
      settleRetry(context, `${context.conversationId}:${context.runId}:/root`, 'success')
      if (asString(data.finalAnswer)) {
        completeFinalAnswer(context, asString(data.finalAnswer))
      }
      context.endStatus = 'completed'
      break

    case 'run_failed': {
      settleRetry(context, scope, 'failed')
      const errorData = data
      if (isAgentCancelledError(errorData)) {
        context.endStatus = 'cancelled'
        break
      }

      context.endStatus = 'failed'
      const resolved = resolveAgentError(errorData)
      context.errorData = typeof errorData.code === 'string'
        ? errorData
        : {
            ...(resolved.code ? { code: resolved.code } : {}),
            message: asString(errorData.message),
            retryable: resolved.retryable,
            ...(resolved.requestId ? { requestId: resolved.requestId } : {}),
          }
      context.errorMessage = resolved.message
      break
    }

    case 'run_cancelled':
      settleRetry(context, scope, 'success')
      context.endStatus = 'cancelled'
      break

    case 'script_output':
      appendScriptLog(context, data)
      break

    case 'artifact_created':
      appendAgentFile(context, { ...data, op: data.operation })
      break

    case 'context_compacted': {
      const compactedCount = asNumber(data.compactedCount) ?? 0
      const completed = data.status !== 'started'
      const targetEvents = agentEventsFor(context, data)
      const existing = targetEvents.find(event => event.type === 'context_compacted' && event.status === 'running')
      if (existing?.type === 'context_compacted') {
        existing.title = completed ? $t('上下文已自动压缩') : $t('正在自动压缩上下文')
        existing.status = completed ? 'success' : 'running'
        existing.compactedCount = compactedCount
        existing.summary = asString(data.summary) || undefined
        existing.timestamp = formatTime(item.timestamp)
        break
      }
      const compactedEvent: AgentContextCompactedProcessEvent = {
        id: `context-compacted-${scope}-${item.sequence}`,
        type: 'context_compacted',
        title: completed ? $t('上下文已自动压缩') : $t('正在自动压缩上下文'),
        compactedCount,
        summary: asString(data.summary) || undefined,
        status: completed ? 'success' : 'running',
        timestamp: formatTime(item.timestamp),
      }
      targetEvents.push(compactedEvent)
      break
    }
  }
}

function pairProcessEventBindings(
  sourceEvents: AgentProcessEvent[],
  boundEvents: AgentProcessEvent[],
  bindings: Map<AgentProcessEvent, AgentProcessEvent>,
): void {
  const claimed = new Set<number>()
  for (let sourceIndex = 0; sourceIndex < sourceEvents.length; sourceIndex++) {
    const source = sourceEvents[sourceIndex]
    let boundIndex = sourceIndex
    let bound = boundEvents[boundIndex]
    if (!bound || bound.id !== source.id || bound.type !== source.type || claimed.has(boundIndex)) {
      boundIndex = boundEvents.findIndex((candidate, index) => (
        !claimed.has(index) && candidate.id === source.id && candidate.type === source.type
      ))
      bound = boundIndex >= 0 ? boundEvents[boundIndex] : undefined
    }
    if (!bound) {
      continue
    }

    claimed.add(boundIndex)
    bindings.set(toRaw(source), bound)
    if (source.type === 'agent_lifecycle' && bound.type === 'agent_lifecycle') {
      pairProcessEventBindings(source.events, bound.events, bindings)
      pairProcessEventBindings(source.children, bound.children, bindings)
    }
  }
}

function rebindProcessBuildContext(context: ProcessBuildContext, process: AgentConversationProcess): void {
  const bindings = new Map<AgentProcessEvent, AgentProcessEvent>()
  pairProcessEventBindings(context.rootEvents, process.events, bindings)
  const boundEvent = <T extends AgentProcessEvent>(event: T): T => (
    bindings.get(toRaw(event)) as T | undefined
  ) ?? event

  for (const [key, event] of context.eventByKey) {
    context.eventByKey.set(key, boundEvent(event))
  }
  for (const [key, event] of context.activeRetriesByScope) {
    context.activeRetriesByScope.set(key, boundEvent(event) as AgentRetryProcessEvent)
  }
  for (const [key, event] of context.agentByPath) {
    context.agentByPath.set(key, boundEvent(event) as AgentLifecycleProcessEvent)
  }
  for (const [key, event] of context.hitlByApprovalId) {
    context.hitlByApprovalId.set(key, boundEvent(event) as AgentHitlProcessEvent)
  }
  if (context.finalAnswer) {
    context.finalAnswer = boundEvent(context.finalAnswer) as AgentFinalAnswerProcessEvent
  }
  context.rootEvents = process.events
}

function createProcessBuildCheckpoint(
  context: ProcessBuildContext,
  events: AgentConversationRunEventDTO[],
): ProcessBuildCheckpoint {
  let lastSequence: number | undefined
  for (const item of events) {
    lastSequence = lastSequence === undefined ? item.sequence : Math.max(lastSequence, item.sequence)
  }
  return {
    context,
    eventCount: events.length,
    lastEvent: events.at(-1),
    lastSequence,
    replayUnsafe: events.some(item => item.event.type === 'run_retrying'),
  }
}

function materializeProcessBuildResult(
  messageId: string,
  events: AgentConversationRunEventDTO[],
  checkpoint: ProcessBuildCheckpoint,
  options: { finalize?: boolean },
  existingProcess?: AgentConversationProcess,
): ProcessBuildResult {
  const context = checkpoint.context
  if (!context.finalAnswer?.content.trim() && context.errorMessage) {
    appendFinalAnswer(context, context.errorMessage)
  }

  const failed = context.endStatus === 'failed'
  const completed = context.endStatus === 'completed'
  const terminal = context.endStatus !== undefined
  if (options.finalize !== false && completed) {
    promoteLastRootContentToFinalAnswer(context)
  }

  if (options.finalize !== false && terminal) {
    finalizeProcessEvents(context.rootEvents, failed)
  }

  context.rootEvents = mergeSpawnAgentLifecycleGroups(context.rootEvents).events

  const finalAnswer = context.finalAnswer?.content || ''
  const serverStartedAt = context.firstTimestamp
  const existingStartedAt = existingProcess?.durationStartedAt
  const durationStartedAt = serverStartedAt === undefined
    ? existingStartedAt
    : (existingStartedAt === undefined ? serverStartedAt : Math.min(serverStartedAt, existingStartedAt))
  const durationMs = durationStartedAt !== undefined && context.lastTimestamp !== undefined
    ? Math.max(0, context.lastTimestamp - durationStartedAt)
    : undefined
  const completedAt = terminal ? formatTime(context.lastTimestamp) : ''
  const process = existingProcess ?? {
    id: `history-process-${messageId}`,
    events: context.rootEvents,
  }
  process.id = `history-process-${messageId}`
  process.revision = events.at(-1)?.sequence ?? checkpoint.lastSequence ?? 0
  process.completed = completed
  process.durationLabel = durationMs !== undefined ? formatDuration(durationMs) : undefined
  process.durationState = terminal ? undefined : 'thinking'
  process.durationStartedAt = durationStartedAt
  process.durationEndedAt = terminal ? context.lastTimestamp : undefined
  process.collapsed = completed
  process.events = context.rootEvents

  return {
    content: finalAnswer,
    completedAt,
    process,
    status: failed ? 'error' : (terminal ? 'done' : 'streaming'),
    errorData: context.errorData,
    checkpoint,
  }
}

function requiresVisibleEventReplay(item: AgentConversationRunEventDTO): boolean {
  if (item.event.type === 'run_retrying') {
    return true
  }
  if (item.event.type === 'run_failed') {
    return item.event.data.code === 'network_interrupted'
  }
  return item.event.type === 'run_cancelled' && item.event.data.reason !== 'user'
}

export function updateProcessFromCheckpoint(
  messageId: string,
  process: AgentConversationProcess,
  events: AgentConversationRunEventDTO[],
  checkpoint: ProcessBuildCheckpoint,
  options: { finalize?: boolean } = { finalize: false },
): ProcessBuildResult | undefined {
  if (checkpoint.replayUnsafe || events.length <= checkpoint.eventCount) {
    return undefined
  }
  if (checkpoint.eventCount > 0 && events[checkpoint.eventCount - 1] !== checkpoint.lastEvent) {
    return undefined
  }

  const suffix = events.slice(checkpoint.eventCount)
  if (suffix.some(requiresVisibleEventReplay)) {
    return undefined
  }

  let previousSequence = checkpoint.lastSequence
  for (const item of suffix) {
    if (previousSequence !== undefined && item.sequence <= previousSequence) {
      return undefined
    }
    previousSequence = item.sequence
  }

  rebindProcessBuildContext(checkpoint.context, process)
  for (const item of suffix) {
    applyProcessRunEvent(checkpoint.context, item)
  }

  checkpoint.eventCount = events.length
  checkpoint.lastEvent = events.at(-1)
  checkpoint.lastSequence = previousSequence
  return materializeProcessBuildResult(messageId, events, checkpoint, options, process)
}

export function buildProcessFromEvents(
  messageId: string,
  events: AgentConversationRunEventDTO[],
  options: { finalize?: boolean } = {},
): ProcessBuildResult {
  const context = createProcessBuildContext(messageId, events)
  for (const item of visibleRunEvents(events)) {
    applyProcessRunEvent(context, item)
  }

  const checkpoint = createProcessBuildCheckpoint(context, events)
  return materializeProcessBuildResult(messageId, events, checkpoint, options)
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
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return undefined
  }

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
      if (message.role === 'assistant') {
        return mapAssistantMessage(conversationId, message, index)
      }

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
