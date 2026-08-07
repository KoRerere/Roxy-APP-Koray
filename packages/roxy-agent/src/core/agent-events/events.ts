import type { AgentErrorEnvelope } from '@/core/agentError'
import type {
  AgentRunEvent,
  AgentRunEventMap,
  AgentRunEventType,
} from '@roxy/shared/channel'
import { statusToCode } from '@/core/agentError'

function event<T extends AgentRunEventType>(
  type: T,
  data: AgentRunEventMap[T],
): AgentRunEvent<T> {
  return { type, data } as AgentRunEvent<T>
}

function todosFrom(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value
  }

  if (value && typeof value === 'object' && Array.isArray((value as { todos?: unknown[] }).todos)) {
    return (value as { todos: unknown[] }).todos
  }
  return []
}

export const runEvents = {
  thinking(text: string, thinkingId: string, workerId?: string) {
    return event('thinking_delta', { text, thinkingId, ...(workerId ? { workerId } : {}) })
  },

  thinkingCompleted(data: AgentRunEventMap['thinking_completed']) {
    return event('thinking_completed', data)
  },

  content(text: string, contentId: string, workerId?: string, phase?: 'answer' | 'synthesis') {
    return event('content_delta', {
      text,
      contentId,
      ...(workerId ? { workerId } : {}),
      ...(phase ? { phase } : {}),
    })
  },

  todo(value: unknown, workerId?: string) {
    return event('todo_delta', {
      todos: todosFrom(value),
      ...(workerId ? { workerId } : {}),
    })
  },

  toolStarted(data: AgentRunEventMap['tool_started']) {
    return event('tool_started', data)
  },

  toolFinished(data: AgentRunEventMap['tool_finished']) {
    return event('tool_finished', data)
  },

  workerDispatched(workerId: string, title: string) {
    return event('worker_dispatched', { workerId, title })
  },

  workerCompleted(data: AgentRunEventMap['worker_completed']) {
    return event('worker_completed', data)
  },

  retry(data: AgentRunEventMap['run_retrying']) {
    return event('run_retrying', data)
  },

  title(title: string) {
    return event('title_changed', { title })
  },

  approvalRequested(data: AgentRunEventMap['approval_requested']) {
    return event('approval_requested', data)
  },

  approvalResolved(data: AgentRunEventMap['approval_resolved']) {
    return event('approval_resolved', data)
  },

  scriptOutput(data: AgentRunEventMap['script_output']) {
    return event('script_output', data)
  },

  artifactCreated(data: AgentRunEventMap['artifact_created']) {
    return event('artifact_created', data)
  },

  tokenUsage(data: AgentRunEventMap['token_usage']) {
    return event('token_usage', data)
  },

  completed(finalAnswer?: string) {
    return event('run_completed', { finalAnswer })
  },

  failed(error: string | AgentErrorEnvelope, httpStatus?: number) {
    if (typeof error === 'string') {
      return event('run_failed', {
        code: httpStatus ? statusToCode(httpStatus) : 'agent_internal_error',
        message: error,
        category: 'internal',
        retryable: false,
        source: 'agent',
        httpStatus,
      })
    }

    return event('run_failed', {
      code: error.code,
      message: error.message,
      category: error.data.category,
      retryable: error.data.retryable,
      source: error.data.source,
      requestId: error.data.requestId,
      provider: error.data.provider,
      model: error.data.model,
      httpStatus: error.data.httpStatus,
    })
  },

  cancelled(
    reason: AgentRunEventMap['run_cancelled']['reason'],
    message?: string,
  ) {
    return event('run_cancelled', { reason, message })
  },
}

export function withWorkerId(input: AgentRunEvent, workerId: string): AgentRunEvent {
  switch (input.type) {
    case 'todo_delta':
    case 'thinking_delta':
    case 'thinking_completed':
    case 'content_delta':
    case 'tool_started':
    case 'tool_finished':
    case 'run_retrying':
    case 'script_output':
      return {
        ...input,
        data: { ...input.data, workerId },
      } as AgentRunEvent
    default:
      return input
  }
}
