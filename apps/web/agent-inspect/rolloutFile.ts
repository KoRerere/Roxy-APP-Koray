import type { RolloutViewerParsedEvent, RolloutViewerSessionDetail } from './api'

export function summarizeText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (Array.isArray(value)) {
    return value.map(item => summarizeText(item)).filter(Boolean).join(' ').trim()
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.text === 'string') {
      return record.text.trim()
    }
    if (typeof record.content === 'string') {
      return record.content.trim()
    }
    if (Array.isArray(record.content)) {
      return summarizeText(record.content)
    }
    if (typeof record.message === 'string') {
      return record.message.trim()
    }
    if (typeof record.thinking === 'string') {
      return record.thinking.trim()
    }
  }
  return ''
}

export function describeEvent(event: Record<string, unknown>): string {
  if (event.type === 'session_start') {
    return 'session_start'
  }
  if (event.type === 'user_input') {
    return summarizeText((event as { message?: unknown }).message) || 'user input'
  }
  if (event.type === 'assistant_turn') {
    return summarizeText((event as { message?: unknown }).message) || 'assistant turn'
  }
  if (event.type === 'tool_result') {
    const result = (event as { result?: Record<string, unknown> }).result ?? {}
    const content = summarizeText(result.content)
    return content || `${String(result.tool_use_id ?? 'tool_result')} result`
  }
  if (event.type === 'compaction') {
    const compactedCount = Number((event as { compactedCount?: unknown }).compactedCount) || 0
    return `compaction (${compactedCount})`
  }
  if (event.type === 'turn_failed') {
    return summarizeText((event as { message?: unknown }).message) || 'turn failed'
  }
  if (event.type === 'turn_error') {
    const message = summarizeText((event as { message?: unknown }).message)
    const name = summarizeText((event as { name?: unknown }).name)
    return [name || 'turn_error', message].filter(Boolean).join(': ')
  }
  if (event.type === 'turn_aborted') {
    return summarizeText((event as { message?: unknown }).message) || 'turn aborted'
  }
  if (event.type === 'hitl_decision') {
    return `HITL ${String((event as { approved?: unknown }).approved ? 'approved' : 'rejected')}`
  }
  if (event.type === 'subagent_delegated') {
    return `delegated ${String((event as { name?: unknown }).name ?? 'subagent')}`
  }
  return String(event.type ?? 'event')
}

export function parseRolloutText(text: string): { events: RolloutViewerParsedEvent[], parseError?: string } {
  const lines = text.split(/\r?\n/)
  const events: RolloutViewerParsedEvent[] = []
  let parseError: string | undefined

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? ''
    if (!raw.trim()) {
      continue
    }
    try {
      const event = JSON.parse(raw) as Record<string, unknown>
      events.push({
        lineNo: index + 1,
        raw,
        event,
        summary: describeEvent(event),
      })
    }
    catch (error) {
      parseError = error instanceof Error ? error.message : String(error)
      break
    }
  }

  return { events, parseError }
}

function buildCounts(events: RolloutViewerParsedEvent[]) {
  const counts: Record<string, number> = {}
  let preview = ''
  let lastEventType: string | undefined
  for (const item of events) {
    const type = String(item.event.type ?? 'unknown')
    counts[type] = (counts[type] ?? 0) + 1
    lastEventType = type
    if (!preview) {
      preview = summarizeText(item.event.message) || summarizeText(item.event.result) || item.summary
    }
  }
  return { counts, preview, lastEventType }
}

function inferSessionId(fileName: string, events: RolloutViewerParsedEvent[]) {
  const sessionStart = events.find(item => item.event.type === 'session_start')?.event
  const eventSessionId = sessionStart?.sessionId ?? sessionStart?.conversationId
  if (typeof eventSessionId === 'string' && eventSessionId.trim()) {
    return eventSessionId.trim()
  }
  return fileName.replace(/\.(jsonl|json)$/i, '') || 'imported-rollout'
}

export function buildImportedSessionDetail(options: {
  fileName: string
  size: number
  updatedAt: number
  text: string
}): RolloutViewerSessionDetail {
  const { events, parseError } = parseRolloutText(options.text)
  if (events.length === 0) {
    throw new Error(parseError ? `无法解析 rollout 文件：${parseError}` : '这个文件没有可展示的 rollout 事件')
  }

  const { counts, preview, lastEventType } = buildCounts(events)
  const sessionId = inferSessionId(options.fileName, events)

  return {
    key: `imported:${options.fileName}:${options.size}:${options.updatedAt}`,
    root: '',
    rootLabel: '导入文件',
    relPath: options.fileName,
    filePath: options.fileName,
    sessionId,
    size: options.size,
    createdAt: options.updatedAt,
    updatedAt: options.updatedAt,
    eventCount: events.length,
    counts,
    preview,
    lastEventType,
    parseError,
    events,
  }
}
