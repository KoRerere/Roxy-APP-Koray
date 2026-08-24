import type { Conversation, Message } from '@/database/conversations'
import type { AgentClarificationQuestion, AgentConversationRunEventDTO, AgentRunEvent } from '@roxy/shared/channel'
import fs from 'node:fs'
import path from 'node:path'
import { agentPaths } from '@/core/storage/agentPaths'
import { runEvents } from './events'

interface RolloutMessage {
  role?: unknown
  content?: unknown
  visible?: unknown
}

type RolloutArtifactOperation = 'create' | 'update'

type RolloutArtifactSource
  = | 'write_file'
    | 'edit_file'
    | 'apply_patch'
    | 'roxy_script_run'
    | 'sandbox_fs'
    | 'sandbox_table'
    | 'sandbox_kv'
    | 'sandbox_download'
    | 'playwright_screenshot'
    | 'playwright_download'
    | 'artifact_root_scan'
    | (string & {})

interface RolloutArtifact {
  fileId: string
  fileName: string
  size: number
  mimeType: string
  operation: RolloutArtifactOperation
  source: RolloutArtifactSource
  virtualPath?: string
  localPath?: string
  displayName?: string
  toolName?: string
  toolUseId?: string
  workerId?: string
  agentPath?: string
}

export type RolloutEvent
  = | {
    type: 'session_start'
    sessionId?: string
    createdAt?: number
    ts?: number
  }
  | { type: 'user_input', message?: RolloutMessage, ts?: number }
  | {
    type: 'assistant_turn'
    items?: unknown[]
    stopReason?: string
    ts?: number
  }
  | { type: 'tool_result', result?: unknown, ts?: number }
  | { type: 'subagent_delegated', childSessionId: string, name: string, ts?: number }
  | { type: 'artifacts_collected', artifacts?: RolloutArtifact[], ts?: number }
  | { type: 'turn_completed', stopReason?: string, ts?: number }
  | { type: 'turn_aborted', message?: string, ts?: number }
  | { type: 'turn_failed', message?: string, ts?: number }
  | {
    type: 'turn_error'
    message?: string
    name?: string
    stack?: string
    cause?: string
    phase?: string
    ts?: number
  }
  | { type: string, [key: string]: unknown }

interface RolloutProjectedEvent {
  event: AgentRunEvent
  timestamp?: number
}

interface RolloutTurn {
  userContent: string
  userTimestamp?: number
  events: RolloutProjectedEvent[]
  terminal?: RolloutTurnTerminal
}

interface RolloutChildProjection {
  events: RolloutProjectedEvent[]
  terminal?: RolloutTurnTerminal
}

interface RolloutTurnTerminal {
  status: 'completed' | 'aborted' | 'failed'
  message?: string
  timestamp?: number
}

interface RolloutEventBuildContext {
  askUserRequests: Map<string, AskUserRequest>
  toolInputs: Map<string, unknown>
  toolNames: Map<string, string>
  nextContentId: () => string
  nextThinkingId: () => string
}

interface AskUserRequest {
  questions?: AgentClarificationQuestion[]
  question?: string
  options?: string[]
}

interface ScriptLogReference {
  dirId?: string
  scriptRunId?: string
  hasLogFile?: boolean
  logPath?: string
  inlineLog?: string
}

interface ScriptLogLine {
  level: string
  message: string
}

export interface RolloutHistoryOptions {
  latestRunId?: string | null
  latestRunStatus?: Conversation['latest_run_status']
  source?: 'user' | 'scheduled_task'
  excludeActiveTurn?: boolean
}

function contentBlockText(block: unknown): string {
  if (!block || typeof block !== 'object') {
    return ''
  }

  const record = block as Record<string, unknown>
  if (record.type === 'text' && typeof record.text === 'string') {
    return record.text
  }
  if (record.type === 'tool_result') {
    const content = record.content
    if (typeof content === 'string') {
      return content
    }
    if (Array.isArray(content)) {
      return content.map(contentBlockText).filter(Boolean).join('\n')
    }
  }
  return ''
}

function rolloutMessageText(message: RolloutMessage | undefined): string {
  const content = message?.content
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    const text = content.map(contentBlockText).filter(Boolean).join('\n')
    if (text.trim()) {
      return text
    }
  }
  return ''
}

function asRolloutMessage(value: unknown): RolloutMessage | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RolloutMessage) : undefined
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function parseToolArguments(value: unknown): unknown {
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

function markdownValue(line: string, prefix: string): string | undefined {
  if (!line.startsWith(prefix)) {
    return undefined
  }

  const value = line.slice(prefix.length).trim()
  if (value.length >= 2 && value.startsWith('`') && value.endsWith('`')) {
    return value.slice(1, -1)
  }
  return undefined
}

function markdownFence(line: string): { marker: string, length: number } | undefined {
  const trimmed = line.trimStart()
  const marker = trimmed[0]
  if (marker !== '`' && marker !== '~') {
    return undefined
  }

  let length = 0
  while (trimmed[length] === marker) {
    length++
  }
  return length >= 3 ? { marker, length } : undefined
}

function scriptLogReferences(content: unknown, input: unknown): ScriptLogReference[] {
  const inputRecord = asRecord(parseToolArguments(input))
  const dirIds = Array.isArray(inputRecord.dirIds)
    ? inputRecord.dirIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : []
  if (typeof content !== 'string') {
    return dirIds.map(dirId => ({ dirId }))
  }

  const references: ScriptLogReference[] = []
  let current: ScriptLogReference | undefined
  let section: 'log_file' | 'log_output' | undefined
  let openFence: { marker: string, length: number } | undefined
  let inlineLines: string[] | undefined

  for (const line of content.split(/\r?\n/)) {
    const fence = markdownFence(line)
    if (openFence) {
      if (fence?.marker === openFence.marker && fence.length >= openFence.length) {
        if (inlineLines && current) {
          current.inlineLog = inlineLines.join('\n')
        }
        openFence = undefined
        inlineLines = undefined
      }
      else if (inlineLines) {
        inlineLines.push(line)
      }
      continue
    }
    if (fence) {
      openFence = fence
      if (section === 'log_output') {
        current ??= { dirId: dirIds.length === 1 ? dirIds[0] : undefined }
        inlineLines = []
      }
      continue
    }

    const windowDirId = markdownValue(line, '### Window ')
    if (windowDirId) {
      current = { dirId: windowDirId }
      references.push(current)
      section = undefined
      continue
    }

    if (line.startsWith('#')) {
      const heading = line.trim()
      section = heading === '## Log file'
        ? 'log_file'
        : heading === '## Log output'
          ? 'log_output'
          : undefined
      if (section === 'log_file') {
        current ??= { dirId: dirIds.length === 1 ? dirIds[0] : undefined }
        current.hasLogFile = true
      }
      continue
    }

    if (!current) {
      current = { dirId: dirIds.length === 1 ? dirIds[0] : undefined }
    }
    const scriptRunId = markdownValue(line, '- runId: ')
    if (scriptRunId) {
      current.scriptRunId = scriptRunId
      continue
    }
    if (section !== 'log_file') {
      continue
    }

    const absolutePath = markdownValue(line, '- absolutePath: ')
    const logPath = absolutePath ?? markdownValue(line, '- path: ')
    if (logPath && path.isAbsolute(logPath)) {
      current.logPath = logPath
    }
  }

  if (references.length > 0) {
    return references
  }
  if (current?.inlineLog !== undefined || current?.logPath || dirIds.length <= 1) {
    return [current ?? { dirId: dirIds[0] }]
  }
  return dirIds.map(dirId => ({ dirId }))
}

function parseScriptLog(content: string): ScriptLogLine[] {
  const lines: ScriptLogLine[] = []
  const logLinePattern = /^\[[^\]]+\] \[([^\]]+)\] ?(.*)$/

  for (const rawLine of content.split(/\r?\n/)) {
    if (!rawLine && lines.length === 0) {
      continue
    }

    const match = logLinePattern.exec(rawLine)
    if (match) {
      lines.push({
        level: match[1]!.toLowerCase(),
        message: match[2] ?? '',
      })
      continue
    }

    const previous = lines.at(-1)
    if (previous) {
      previous.message += `\n${rawLine}`
    }
    else if (rawLine) {
      lines.push({ level: 'info', message: rawLine })
    }
  }

  const finalLine = lines.at(-1)
  if (finalLine?.message.endsWith('\n')) {
    finalLine.message = finalLine.message.slice(0, -1)
  }
  return lines
}

function scriptOutputEvents(
  toolId: string | undefined,
  input: unknown,
  content: unknown,
): AgentRunEvent[] {
  const inputRecord = asRecord(parseToolArguments(input))
  const scriptName = typeof inputRecord.scriptPath === 'string' ? inputRecord.scriptPath : undefined

  return scriptLogReferences(content, input).flatMap((reference): AgentRunEvent[] => {
    const baseData = {
      toolId,
      scriptName,
      scriptRunId: reference.scriptRunId,
      dirId: reference.dirId,
    }
    if (reference.inlineLog !== undefined) {
      return parseScriptLog(reference.inlineLog).map(line => ({
        type: 'script_output',
        data: {
          ...baseData,
          level: line.level,
          message: line.message,
        },
      }))
    }
    if (!reference.hasLogFile) {
      return []
    }
    if (!reference.logPath || !fs.existsSync(reference.logPath)) {
      return [{
        type: 'script_output',
        data: {
          ...baseData,
          level: 'info',
          message: '',
          unavailableReason: 'file_missing',
        },
      }]
    }

    let logContent: string
    try {
      logContent = fs.readFileSync(reference.logPath, 'utf-8')
    }
    catch {
      return [{
        type: 'script_output',
        data: {
          ...baseData,
          level: 'info',
          message: '',
          unavailableReason: 'file_missing',
        },
      }]
    }

    return parseScriptLog(logContent).map(line => ({
      type: 'script_output',
      data: {
        ...baseData,
        level: line.level,
        message: line.message,
      },
    }))
  })
}

function askUserQuestion(value: unknown): AgentClarificationQuestion | undefined {
  const record = asRecord(value)
  const header = typeof record.header === 'string' ? record.header.trim() : ''
  const id = typeof record.id === 'string' ? record.id.trim() : ''
  const question = typeof record.question === 'string' ? record.question.trim() : ''
  const options = Array.isArray(record.options)
    ? record.options.map((option) => {
        const optionRecord = asRecord(option)
        const label = typeof optionRecord.label === 'string' ? optionRecord.label.trim() : ''
        const description = typeof optionRecord.description === 'string' ? optionRecord.description.trim() : ''
        return label && description ? { label, description } : undefined
      }).filter((option): option is AgentClarificationQuestion['options'][number] => Boolean(option))
    : []

  if (!header || header.length > 12 || !id || !question || options.length < 2 || options.length > 3) {
    return undefined
  }

  return { header, id, question, options }
}

function askUserRequest(input: unknown): AskUserRequest | undefined {
  const record = asRecord(parseToolArguments(input))
  if (Array.isArray(record.questions)) {
    const questions = record.questions.map(askUserQuestion)
    if (questions.length >= 1 && questions.length <= 3 && questions.every(Boolean)) {
      return { questions: questions as AgentClarificationQuestion[] }
    }
    return undefined
  }

  const question = typeof record.question === 'string' ? record.question.trim() : ''
  if (!question) {
    return undefined
  }

  const options = Array.isArray(record.options)
    ? record.options.filter((option): option is string => typeof option === 'string' && option.trim().length > 0)
    : []
  return {
    question,
    ...(options.length > 0 ? { options } : {}),
  }
}

function getRolloutPath(conversationId: string): string {
  const paths = agentPaths as typeof agentPaths & {
    sessionRollout?: (sessionId: string, createdAt?: Date) => string
  }
  return paths.sessionRollout ? paths.sessionRollout(conversationId) : path.join(agentPaths.sessionDir(conversationId), 'rollout.jsonl')
}

export function readRolloutEvents(conversationId: string): RolloutEvent[] {
  const rolloutPath = getRolloutPath(conversationId)
  if (!fs.existsSync(rolloutPath)) {
    return []
  }

  let content = ''
  try {
    content = fs.readFileSync(rolloutPath, 'utf-8')
  }
  catch {
    return []
  }

  const events: RolloutEvent[] = []
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) {
      continue
    }

    try {
      events.push(JSON.parse(line) as RolloutEvent)
    }
    catch {
      break
    }
  }

  return events
}

function assistantItemEvents(item: unknown, context: RolloutEventBuildContext): AgentRunEvent[] {
  if (!item || typeof item !== 'object') {
    return []
  }

  const record = item as Record<string, unknown>
  if (record.type === 'reasoning') {
    const text
      = typeof record.text === 'string'
        ? record.text
        : Array.isArray(record.summary)
          ? record.summary.filter((value): value is string => typeof value === 'string').join('\n')
          : ''
    if (!text.trim()) {
      return []
    }
    const thinkingId = typeof record.id === 'string' ? record.id : context.nextThinkingId()
    return [
      { type: 'thinking_delta', data: { id: thinkingId, thinkingId, text } },
      {
        type: 'thinking_completed',
        data: {
          id: thinkingId,
          thinkingId,
          startTimestamp: 0,
          endTimestamp: 0,
          durationMs: 0,
        },
      },
    ]
  }

  if (record.type === 'message') {
    const texts = Array.isArray(record.content)
      ? record.content
          .filter(block => block && typeof block === 'object')
          .map(block => block as Record<string, unknown>)
          .filter(block => block.type === 'output_text' && typeof block.text === 'string')
          .map(block => block.text as string)
      : []
    return texts
      .filter(text => text.trim().length > 0)
      .map((text) => {
        const contentId = typeof record.id === 'string' ? record.id : context.nextContentId()
        return {
          type: 'content_delta',
          data: { id: contentId, contentId, text },
        } as AgentRunEvent
      })
  }

  if (record.type === 'tool_call') {
    const toolId = typeof record.callId === 'string' ? record.callId : typeof record.id === 'string' ? record.id : undefined
    const toolName = typeof record.name === 'string' ? record.name : 'tool'
    if (toolId) {
      context.toolNames.set(toolId, toolName)
      context.toolInputs.set(toolId, record.arguments)
    }
    const toolInput = asRecord(parseToolArguments(record.arguments))
    const target = toolName === 'roxy_script_run' && typeof toolInput.scriptPath === 'string'
      ? toolInput.scriptPath
      : undefined
    const events: AgentRunEvent[] = [
      {
        type: 'tool_started',
        data: {
          toolName,
          toolId,
          input: record.arguments,
          ...(target ? { target } : {}),
        },
      },
    ]
    if (toolName === 'ask_user' && toolId) {
      const request = askUserRequest(record.arguments)
      if (request) {
        context.askUserRequests.set(toolId, request)
        const firstQuestion = request.questions?.[0]
        events.push({
          type: 'approval_requested',
          data: {
            approvalId: toolId,
            actionRequests: [],
            reviewConfigs: [],
            requestKind: 'clarification',
            title: '需要您的输入',
            prompt: firstQuestion?.question ?? request.question,
            subjects: [],
            controls: firstQuestion
              ? []
              : request.options?.length
              ? [{
                  id: 'answer',
                  kind: 'choice',
                  required: true,
                  options: request.options.map((option, index) => ({
                    id: `option-${index + 1}`,
                    label: option,
                    value: option,
                    variant: 'secondary',
                  })),
                }]
              : [
                  {
                    id: 'answer',
                    kind: 'textarea',
                    label: '回答',
                    required: true,
                    placeholder: '请输入回答',
                  },
                  {
                    id: 'submit',
                    kind: 'choice',
                    required: true,
                    options: [{ id: 'submit', label: '提交', value: true, variant: 'primary' }],
                  },
                ],
            values: { answer: null },
            ...(request.questions ? { questions: request.questions } : {}),
          },
        })
      }
    }
    return events
  }

  if (record.type === 'web_search_call') {
    const toolId = typeof record.id === 'string' ? record.id : undefined
    const events: AgentRunEvent[] = [
      {
        type: 'tool_started',
        data: {
          toolName: 'web_search',
          toolId,
          input: record.action ?? null,
        },
      },
    ]
    if (record.status === 'completed' || record.status === 'failed') {
      events.push({
        type: 'tool_finished',
        data: {
          toolName: 'web_search',
          toolId,
          output: null,
          status: record.status === 'failed' ? 'failed' : 'success',
        },
      })
    }
    return events
  }

  return []
}

function assistantTurnEvents(event: Extract<RolloutEvent, { type: 'assistant_turn' }>, context: RolloutEventBuildContext): AgentRunEvent[] {
  if (Array.isArray(event.items)) {
    return event.items.flatMap(item => assistantItemEvents(item, context))
  }
  return []
}

function toolResultEvents(event: RolloutEvent, context: RolloutEventBuildContext): AgentRunEvent[] {
  if (event.type !== 'tool_result') {
    return []
  }
  const result = (event as { result?: unknown }).result
  if (!result || typeof result !== 'object') {
    return []
  }
  const record = result as Record<string, unknown>
  const toolId = typeof record.tool_use_id === 'string' ? record.tool_use_id : undefined
  const toolName = toolId ? (context.toolNames.get(toolId) ?? 'unknown') : 'unknown'
  const events: AgentRunEvent[] = toolName === 'roxy_script_run'
    ? scriptOutputEvents(toolId, toolId ? context.toolInputs.get(toolId) : undefined, record.content)
    : []
  events.push(
    {
      type: 'tool_finished',
      data: {
        toolName,
        toolId,
        output: record.content,
        status: record.is_error === true ? 'failed' : 'success',
      },
    },
  )
  if (toolId && context.askUserRequests.has(toolId)) {
    events.push({
      type: 'approval_resolved',
      data: {
        approvalId: toolId,
        decisions: [{
          type: 'answer',
          answer: typeof record.content === 'string' ? record.content : '',
        }],
      },
    })
    context.askUserRequests.delete(toolId)
  }
  return events
}

function isValidRolloutArtifact(artifact: RolloutArtifact): boolean {
  return typeof artifact.fileId === 'string' && artifact.fileId.length > 0
    && typeof artifact.fileName === 'string' && artifact.fileName.length > 0
    && typeof artifact.size === 'number' && Number.isFinite(artifact.size)
    && typeof artifact.mimeType === 'string' && artifact.mimeType.length > 0
    && (artifact.operation === 'create' || artifact.operation === 'update')
}

function artifactCollectedEvents(event: RolloutEvent): AgentRunEvent[] {
  if (event.type !== 'artifacts_collected' || !Array.isArray(event.artifacts)) {
    return []
  }

  return event.artifacts
    .filter(isValidRolloutArtifact)
    .map(artifact => ({
      type: 'artifact_created',
      data: {
        ...(typeof artifact.agentPath === 'string' && artifact.agentPath.length > 0 ? { agentPath: artifact.agentPath } : {}),
        fileId: artifact.fileId,
        fileName: artifact.fileName,
        size: artifact.size,
        mimeType: artifact.mimeType,
        operation: artifact.operation,
      },
    }))
}

function childAgentPath(name: string, parentAgentPath = '/root'): string {
  const normalized = name.trim().replace(/[^a-z0-9_]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase()
  return `${parentAgentPath}/${normalized || 'agent'}`
}

function withReplayAgentPath(event: AgentRunEvent, agentPath: string): AgentRunEvent {
  const existingPath = event.data && typeof event.data === 'object' && 'agentPath' in event.data
    ? (event.data as { agentPath?: unknown }).agentPath
    : undefined
  if (typeof existingPath === 'string' && existingPath.length > 0) {
    return event
  }
  return {
    ...event,
    data: { ...event.data, agentPath },
  } as AgentRunEvent
}

function projectDelegatedChild(
  delegation: Extract<RolloutEvent, { type: 'subagent_delegated' }>,
  parentAgentPath = '/root',
  ancestry = new Set<string>(),
): RolloutChildProjection {
  const agentPath = childAgentPath(delegation.name, parentAgentPath)
  if (ancestry.has(delegation.childSessionId)) {
    return { events: [] }
  }
  const childTurns = readRolloutTurns(delegation.childSessionId, {
    parentAgentPath: agentPath,
    ancestry: new Set([...ancestry, delegation.childSessionId]),
  })
  const childEvents = childTurns.flatMap(turn => turn.events)
  const terminal = [...childTurns].reverse().find(turn => turn.terminal)?.terminal
  const startedAt = delegation.ts ?? childTurns[0]?.userTimestamp
  const lifecycleStart = runEvents.agentLifecycle({
    agentPath,
    parentAgentPath,
    agentName: delegation.name,
    agentType: 'general-purpose',
    status: 'starting',
    ...(startedAt !== undefined ? { startedAt } : {}),
  })
  const lifecycleEndStatus = terminal?.status === 'aborted'
    ? 'cancelled'
    : terminal?.status ?? 'running'
  const lifecycleEnd = runEvents.agentLifecycle({
    agentPath,
    parentAgentPath,
    agentName: delegation.name,
    agentType: 'general-purpose',
    status: lifecycleEndStatus,
    ...(startedAt !== undefined ? { startedAt } : {}),
    ...(terminal?.timestamp !== undefined ? { finishedAt: terminal.timestamp } : {}),
    ...(lastContentText(childEvents) ? { report: lastContentText(childEvents) } : {}),
  })

  return {
    events: [
      {
        event: lifecycleStart,
        timestamp: startedAt,
      },
      ...childEvents.map(item => ({
        event: withReplayAgentPath(item.event, agentPath),
        timestamp: item.timestamp,
      })),
      {
        event: lifecycleEnd,
        timestamp: terminal?.timestamp ?? childEvents.at(-1)?.timestamp ?? startedAt,
      },
    ],
    terminal,
  }
}

function rolloutEventTimestamp(event: RolloutEvent): number | undefined {
  return typeof event.ts === 'number' && Number.isFinite(event.ts) ? event.ts : undefined
}

function rolloutTurnTerminal(event: RolloutEvent): RolloutTurnTerminal | undefined {
  const timestamp = rolloutEventTimestamp(event)
  if (event.type === 'turn_completed') {
    return { status: 'completed', timestamp }
  }
  if (event.type === 'turn_aborted') {
    return {
      status: 'aborted',
      ...(typeof event.message === 'string' && event.message ? { message: event.message } : {}),
      timestamp,
    }
  }
  if (event.type === 'turn_failed') {
    return {
      status: 'failed',
      ...(typeof event.message === 'string' && event.message ? { message: event.message } : {}),
      timestamp,
    }
  }
  return undefined
}

function readRolloutTurns(
  conversationId: string,
  options: { parentAgentPath?: string, ancestry?: Set<string> } = {},
): RolloutTurn[] {
  const ancestry = options.ancestry ?? new Set([conversationId])
  const rolloutEvents = readRolloutEvents(conversationId)
  const turns: RolloutTurn[] = []
  let current: RolloutTurn | undefined
  let contentIndex = 0
  let thinkingIndex = 0
  const context: RolloutEventBuildContext = {
    askUserRequests: new Map(),
    toolInputs: new Map(),
    toolNames: new Map(),
    nextContentId: () => `rollout-content-${++contentIndex}`,
    nextThinkingId: () => `rollout-thinking-${++thinkingIndex}`,
  }

  for (const event of rolloutEvents) {
    if (event.type === 'user_input') {
      const message = asRolloutMessage(event.message)
      if (message?.visible === false) {
        continue
      }
      if (current) {
        turns.push(current)
      }
      current = {
        userContent: rolloutMessageText(message),
        userTimestamp: rolloutEventTimestamp(event),
        events: [],
      }
      continue
    }

    if (!current) {
      continue
    }

    if (event.type === 'assistant_turn') {
      const timestamp = rolloutEventTimestamp(event)
      const assistantEvent = event as Extract<RolloutEvent, { type: 'assistant_turn' }>
      current.events.push(
        ...assistantTurnEvents(assistantEvent, context).map(projectEvent => ({
          event: projectEvent,
          timestamp,
        })),
      )
    }
    else if (event.type === 'tool_result') {
      const timestamp = rolloutEventTimestamp(event)
      current.events.push(
        ...toolResultEvents(event, context).map(projectEvent => ({
          event: projectEvent,
          timestamp,
        })),
      )
    }
    else if (event.type === 'artifacts_collected') {
      const timestamp = rolloutEventTimestamp(event)
      current.events.push(
        ...artifactCollectedEvents(event).map(projectEvent => ({
          event: projectEvent,
          timestamp,
        })),
      )
    }
    else if (event.type === 'subagent_delegated') {
      const child = projectDelegatedChild(
        event as Extract<RolloutEvent, { type: 'subagent_delegated' }>,
        options.parentAgentPath,
        ancestry,
      )
      current.events.push(...child.events)
    }
    else {
      const terminal = rolloutTurnTerminal(event)
      if (terminal) {
        current.terminal = terminal
      }
    }
  }

  if (current) {
    turns.push(current)
  }
  return turns
}

function timestampMs(value: string | undefined): number {
  if (!value) {
    return Date.now()
  }
  const parsed = new Date(value.replace(' ', 'T')).getTime()
  return Number.isNaN(parsed) ? Date.now() : parsed
}

function lastContentText(events: RolloutProjectedEvent[]): string {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]?.event
    if (event?.type === 'content_delta') {
      return event.data.text
    }
  }
  return ''
}

function terminalEvent(
  terminal: RolloutTurnTerminal | undefined,
  status: Conversation['latest_run_status'],
  finalAnswer: string,
): AgentRunEvent | undefined {
  if (terminal?.status === 'completed') {
    return { type: 'run_completed', data: { finalAnswer } }
  }
  if (terminal?.status === 'aborted') {
    return {
      type: 'run_cancelled',
      data: {
        reason: 'user',
        ...(terminal.message ? { message: terminal.message } : {}),
      },
    }
  }
  if (terminal?.status === 'failed') {
    return {
      type: 'run_failed',
      data: {
        code: 'agent_internal_error',
        message: terminal.message ?? 'Agent run failed.',
        category: 'internal',
        retryable: false,
        source: 'agent',
      },
    }
  }
  if (status === 'streaming') {
    return undefined
  }
  if (status === 'failed') {
    return {
      type: 'run_failed',
      data: {
        code: 'agent_internal_error',
        message: 'Agent run failed.',
        category: 'internal',
        retryable: false,
        source: 'agent',
      },
    }
  }
  if (status === 'cancelled') {
    return { type: 'run_cancelled', data: { reason: 'user' } }
  }
  return { type: 'run_completed', data: { finalAnswer } }
}

function historyRunId(input: {
  conversationId: string
  index: number
  isLatestTurn: boolean
  latestRunId?: string | null
}): string {
  if (input.isLatestTurn && input.latestRunId) {
    return input.latestRunId
  }
  return `history-run-${input.conversationId}-${input.index + 1}`
}

function buildRolloutRunEvents(input: {
  conversationId: string
  index: number
  user: Message
  assistant: Message
  turn: RolloutTurn
  status: Conversation['latest_run_status']
  forceCompleted: boolean
  latestRunId?: string | null
  source?: 'user' | 'scheduled_task'
}): AgentConversationRunEventDTO[] {
  const runId = historyRunId({
    conversationId: input.conversationId,
    index: input.index,
    isLatestTurn: !input.forceCompleted,
    latestRunId: input.latestRunId,
  })
  const turnId = input.user.id
  const assistantMessageId = input.assistant.id
  const fallbackTimestamp = timestampMs(input.assistant.created_at || input.user.created_at)
  const startedAt = input.turn.userTimestamp ?? timestampMs(input.user.created_at)
  const events: RolloutProjectedEvent[] = [
    {
      timestamp: startedAt,
      event: {
        type: 'run_started',
        data: {
          source: input.source ?? 'user',
          assistantMessageId,
          startedAt,
        },
      },
    },
    {
      timestamp: startedAt,
      event: {
        type: 'user_message',
        data: {
          messageId: input.user.id,
          content: input.user.content ?? input.turn.userContent,
          attachments: [],
          createdAt: startedAt,
        },
      },
    },
    ...input.turn.events,
  ]

  const terminal = terminalEvent(
    input.turn.terminal,
    input.forceCompleted ? 'completed' : input.status,
    lastContentText(input.turn.events),
  )
  if (terminal) {
    events.push({
      event: terminal,
      timestamp: input.turn.terminal?.timestamp ?? input.turn.events.at(-1)?.timestamp ?? fallbackTimestamp,
    })
  }

  return events.map((item, index) => ({
    conversationId: input.conversationId,
    runId,
    turnId,
    assistantMessageId,
    sequence: index + 1,
    timestamp: item.timestamp ?? fallbackTimestamp,
    event: item.event,
  }))
}

function messageCreatedAt(timestamp: number | undefined, fallback: string): string {
  if (!timestamp) {
    return fallback
  }
  return new Date(timestamp).toISOString()
}

export function projectMessagesFromRollout(conversationId: string, options: RolloutHistoryOptions = {}): Message[] {
  let turns = readRolloutTurns(conversationId)
  if (options.excludeActiveTurn && turns.at(-1)?.terminal === undefined) {
    turns = turns.slice(0, -1)
  }
  if (turns.length === 0) {
    return []
  }

  const fallbackCreatedAt = new Date(0).toISOString()
  const messages: Message[] = []

  turns.forEach((turn, index) => {
    const user: Message = {
      id: `${conversationId}-rollout-user-${index + 1}`,
      conversation_id: conversationId,
      role: 'user',
      content: turn.userContent,
      content_type: 'text',
      storage_type: 'inline',
      created_at: messageCreatedAt(turn.userTimestamp, fallbackCreatedAt),
    }
    messages.push(user)

    const assistant: Message = {
      id: `${conversationId}-rollout-assistant-${index + 1}`,
      conversation_id: conversationId,
      role: 'assistant',
      content: lastContentText(turn.events),
      content_type: 'text',
      storage_type: 'inline',
      created_at: messageCreatedAt(turn.events.at(-1)?.timestamp ?? turn.terminal?.timestamp, user.created_at),
    }

    if (turn.events.length > 0 || turn.terminal || index === turns.length - 1) {
      assistant.events = buildRolloutRunEvents({
        conversationId,
        index,
        user,
        assistant,
        turn,
        status: index === turns.length - 1 ? (options.latestRunStatus ?? null) : 'completed',
        forceCompleted: index < turns.length - 1,
        latestRunId: options.latestRunId,
        source: options.source,
      })
      messages.push(assistant)
    }
  })

  return messages
}
