import type { RolloutViewerParsedEvent } from './api'

export interface ToolResultDetails {
  toolUseId: string
  toolName: string
  input?: unknown
  content: string
  failed: boolean
  durationMs?: number
}

interface ToolCallDetails {
  toolName: string
  input?: unknown
  startedAt?: number
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function timestamp(event: Record<string, unknown>): number | undefined {
  const value = event.ts ?? event.createdAt
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function contentAsText(value: unknown): string {
  if (typeof value === 'string') {
    return value.replaceAll('\\n', '\n')
  }
  if (value === undefined || value === null) {
    return ''
  }
  try {
    return JSON.stringify(value, null, 2)
  }
  catch {
    return String(value)
  }
}

function toolCalls(entry: RolloutViewerParsedEvent): Array<{ id: string, details: ToolCallDetails }> {
  if (entry.event.type !== 'assistant_turn') {
    return []
  }

  const startedAt = timestamp(entry.event)
  const candidates: unknown[] = []
  if (Array.isArray(entry.event.items)) {
    candidates.push(...entry.event.items)
  }

  const message = record(entry.event.message)
  if (Array.isArray(message.content)) {
    candidates.push(...message.content)
  }

  return candidates.flatMap((value) => {
    const call = record(value)
    if (call.type === 'tool_call') {
      const id = typeof call.callId === 'string' ? call.callId : typeof call.id === 'string' ? call.id : ''
      if (!id) {
        return []
      }
      return [{
        id,
        details: {
          toolName: typeof call.name === 'string' ? call.name : 'unknown',
          input: call.arguments,
          startedAt,
        },
      }]
    }

    if (call.type === 'tool_use') {
      const id = typeof call.id === 'string' ? call.id : ''
      if (!id) {
        return []
      }
      return [{
        id,
        details: {
          toolName: typeof call.name === 'string' ? call.name : 'unknown',
          input: call.input,
          startedAt,
        },
      }]
    }

    return []
  })
}

export function buildToolResultDetails(events: RolloutViewerParsedEvent[]): Map<number, ToolResultDetails> {
  const calls = new Map<string, ToolCallDetails>()
  const results = new Map<number, ToolResultDetails>()

  for (const entry of events) {
    for (const call of toolCalls(entry)) {
      calls.set(call.id, call.details)
    }

    if (entry.event.type !== 'tool_result') {
      continue
    }

    const result = record(entry.event.result)
    const toolUseId = typeof result.tool_use_id === 'string' ? result.tool_use_id : 'unknown'
    const call = calls.get(toolUseId)
    const finishedAt = timestamp(entry.event)
    const durationMs = call?.startedAt !== undefined && finishedAt !== undefined
      ? Math.max(0, finishedAt - call.startedAt)
      : undefined

    results.set(entry.lineNo, {
      toolUseId,
      toolName: call?.toolName ?? toolUseId,
      input: call?.input,
      content: contentAsText(result.content),
      failed: result.is_error === true,
      durationMs,
    })
  }

  return results
}
