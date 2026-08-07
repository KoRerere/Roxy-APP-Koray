import type { AgentRunEvent } from '@roxy/shared/channel'
import { runEvents } from './events'

export interface DecodedSseEvent {
  event: string
  id?: string
  data: string
  value: unknown
}

function parseBlock(block: string): DecodedSseEvent | null {
  let event = 'message'
  let id: string | undefined
  const dataLines: string[] = []

  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(':'))
      continue
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    }
    else if (line.startsWith('id:')) {
      id = line.slice(3).trim()
    }
    else if (line.startsWith('data:')) {
      const value = line.slice(5)
      dataLines.push(value.startsWith(' ') ? value.slice(1) : value)
    }
  }

  const data = dataLines.join('\n')
  if (!data || data === '[DONE]')
    return null

  try {
    return { event, id, data, value: JSON.parse(data) }
  }
  catch {
    return null
  }
}

export class SseDecoder {
  private buffer = ''

  push(chunk: string, flush = false): DecodedSseEvent[] {
    this.buffer += chunk
    const out: DecodedSseEvent[] = []
    let match = /\r?\n\r?\n/.exec(this.buffer)

    while (match) {
      const block = this.buffer.slice(0, match.index)
      this.buffer = this.buffer.slice(match.index + match[0].length)
      const parsed = parseBlock(block)
      if (parsed)
        out.push(parsed)
      match = /\r?\n\r?\n/.exec(this.buffer)
    }

    if (flush && this.buffer.trim()) {
      const parsed = parseBlock(this.buffer)
      this.buffer = ''
      if (parsed)
        out.push(parsed)
    }
    return out
  }
}

function record(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
}

export function legacySseEventToRunEvent(decoded: DecodedSseEvent): AgentRunEvent | null {
  const payload = record(decoded.value)
  const type = typeof payload.type === 'string' ? payload.type : decoded.event
  const data = record(payload.data)
  const workerId = data.workerId ?? data.taskId

  switch (type) {
    case 'thinking':
    case 'worker_thinking':
      return runEvents.thinking(data.text ?? '', data.thinkingId ?? `legacy-thinking-${decoded.id ?? Date.now()}`, workerId)
    case 'thinking_complete':
      return runEvents.thinkingCompleted({
        thinkingId: data.thinkingId ?? `legacy-thinking-${decoded.id ?? Date.now()}`,
        startTimestamp: Number(data.startTimestamp) || 0,
        endTimestamp: Number(data.endTimestamp) || 0,
        durationMs: Number(data.durationMs) || 0,
        ...(workerId ? { workerId } : {}),
      })
    case 'content':
    case 'worker_content':
      return runEvents.content(data.text ?? '', data.contentId ?? `legacy-content-${decoded.id ?? Date.now()}`, workerId)
    case 'synthesis':
      return runEvents.content(data.text ?? '', data.contentId ?? `legacy-synthesis-${decoded.id ?? Date.now()}`, workerId, 'synthesis')
    case 'planning':
    case 'todo':
    case 'worker_todo':
      return runEvents.todo(data, workerId)
    case 'tool_call':
      return runEvents.toolStarted({
        toolName: data.toolName ?? 'tool',
        input: data.args,
        toolId: data.toolId,
        workerId,
        assignmentsCount: data.assignmentsCount,
        skillName: data.skillName,
        skillFilePath: data.skillFilePath,
        target: data.target,
      })
    case 'tool_result':
      return runEvents.toolFinished({
        toolName: data.toolName ?? 'tool',
        output: data.result,
        toolId: data.toolId,
        workerId,
        durationMs: data.et,
        status: data.status === 'failed' ? 'failed' : 'success',
      })
    case 'worker_dispatch':
      return runEvents.workerDispatched(data.taskId ?? data.workerId ?? 'legacy-worker', data.title ?? '')
    case 'worker_result':
      return runEvents.workerCompleted({
        workerId: data.taskId ?? data.workerId ?? 'legacy-worker',
        status: data.status === 'success' ? 'success' : 'failed',
        exitCode: data.exitCode,
        signal: data.signal,
        error: data.error,
        durationMs: data.durationMs,
      })
    case 'worker_stopped':
      return runEvents.workerCompleted({
        workerId: data.taskId ?? data.workerId ?? 'legacy-worker',
        status: 'cancelled',
        error: data.error,
      })
    case 'retry':
    case 'worker_retry':
      return runEvents.retry({
        retryId: data.retryId,
        attempt: Number(data.attempt) || 1,
        maxAttempts: Number(data.maxAttempts) || 1,
        reason: data.reason,
        workerId,
      })
    case 'title':
      return runEvents.title(data.title ?? '')
    case 'hitl_interrupt':
      return runEvents.approvalRequested({
        approvalId: data.interruptsId ?? data.approvalId ?? 'legacy-approval',
        actionRequests: Array.isArray(data.actionRequests) ? data.actionRequests : [],
        reviewConfigs: Array.isArray(data.reviewConfigs) ? data.reviewConfigs : [],
      })
    case 'hitl_resume':
      return runEvents.approvalResolved({
        approvalId: data.interruptsId ?? data.approvalId ?? 'legacy-approval',
        decisions: Array.isArray(data.decisions) ? data.decisions : [],
      })
    case 'script_log':
      return runEvents.scriptOutput({
        scriptName: data.scriptName,
        level: data.level ?? 'info',
        message: data.message ?? data.text ?? '',
        toolId: data.toolId,
        scriptRunId: data.runId,
        workerId,
      })
    case 'agent_file':
      return runEvents.artifactCreated({
        fileId: data.fileId ?? '',
        fileName: data.fileName ?? '',
        size: Number(data.size) || 0,
        mimeType: data.mimeType ?? 'application/octet-stream',
        operation: data.op === 'update' ? 'update' : 'create',
      })
    case 'image_generating':
      return runEvents.toolStarted({
        toolName: 'image_generation',
        input: { count: Number(data.count) || 0 },
      })
    case 'image_partial':
      return runEvents.toolFinished({
        toolName: 'image_generation',
        output: data,
        toolId: `image-${Number(data.index) || 0}`,
        status: 'success',
      })
    case 'token_usage':
      return runEvents.tokenUsage({ current: data.current, delta: data.delta })
    case 'done':
      return runEvents.completed(data.finalAnswer)
    case 'error':
      return {
        type: 'run_failed',
        data: {
          code: data.code ?? 'agent_internal_error',
          message: data.message ?? 'Agent run failed',
          category: data.category,
          retryable: Boolean(data.retryable),
          source: data.source,
          requestId: data.requestId,
          provider: data.provider,
          model: data.model,
          httpStatus: data.httpStatus ?? data.errorCode,
        },
      }
    case 'interrupt':
    case 'orchestrator_stopped':
      return runEvents.cancelled('user', data.message)
    default:
      return null
  }
}

export function decodeLegacySse(content: string): Array<{ event: AgentRunEvent, timestamp?: number }> {
  const decoder = new SseDecoder()
  return decoder.push(content, true).flatMap((item) => {
    const event = legacySseEventToRunEvent(item)
    if (!event)
      return []
    const payload = record(item.value)
    const timestamp = Number(payload.timestamp ?? item.id)
    return [{ event, ...(Number.isFinite(timestamp) ? { timestamp } : {}) }]
  })
}
