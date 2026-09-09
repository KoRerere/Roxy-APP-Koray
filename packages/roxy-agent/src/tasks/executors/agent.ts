import type { ResolvedTaskWindow, TaskExecutorResult } from '../types'
import type { ResolvedTemplate } from '@/services/templateService'
import type { AgentRunEvent } from '@roxy/shared/channel'
import {
  serializeAgentProfileReference,
  serializeAgentSkillReference,
} from '@roxy/shared'
import { randomUUID } from 'node:crypto'
import { runEventHub } from '@/core/agent-events/runEventHub'
import { cleanupRun, createAbort } from '@/core/registry/abortRegistry'
import { ChatContextAPI } from '@/database/conversations'
import { runConversationTurn } from '@/services/chatService'
import {
  recordTaskExecutionEvent,
  taskArtifacts,
} from '@/services/taskExecutionDetails'
import { ensureResolvedTemplateSkillInstalled } from '@/services/templateService'
import { TASK_ERROR_CODES } from '../errorCodes'

export interface PreparedTaskSkill {
  skillMdPath: string
}

export interface AgentTaskExecutionInput {
  taskName: string
  templateName: string
  taskLogId: string
  prompt: string
  windows: ResolvedTaskWindow[]
  signal: AbortSignal
  skill?: PreparedTaskSkill
  onConversationCreated?: (conversationId: string) => void
}

export async function prepareTaskSkill(
  template: ResolvedTemplate,
  signal?: AbortSignal,
): Promise<PreparedTaskSkill> {
  if (template.kind !== 'skill') {
    throw new Error('Template is not a Skill template')
  }

  const installed = await ensureResolvedTemplateSkillInstalled(template, signal)
  return { skillMdPath: installed.skillMdPath }
}

export function buildTaskInitialUserMessage(input: AgentTaskExecutionInput): string {
  const parts: string[] = []
  if (input.skill) {
    parts.push(serializeAgentSkillReference(input.templateName, input.skill.skillMdPath))
  }

  parts.push(input.prompt.trim())
  if (input.windows.length > 0) {
    const windowReference = serializeAgentProfileReference(input.windows.map(window => window.dirId))
    parts.push(`[请使用 ${windowReference} 窗口完成这个任务]`)
  }
  return parts.filter(Boolean).join(' ')
}

export interface TaskAssistantContent {
  contentId: string
  content: string
}

export function collectTaskAssistantMessages(events: AgentRunEvent[]): TaskAssistantContent[] {
  const chunks = new Map<string, string>()
  const order: string[] = []

  for (const event of events) {
    if (event.type !== 'content_delta' || event.data.workerId) {
      continue
    }

    const contentId = event.data?.contentId
    const text = event.data?.text
    if (!contentId || !text) {
      continue
    }

    if (!chunks.has(contentId)) {
      order.push(contentId)
    }
    chunks.set(contentId, `${chunks.get(contentId) ?? ''}${text}`)
  }
  return order
    .map(contentId => ({ contentId, content: chunks.get(contentId)?.trim() ?? '' }))
    .filter(message => message.content)
}

export async function executeAgentTask(input: AgentTaskExecutionInput): Promise<TaskExecutorResult> {
  const suffix = `${Date.now()}_${randomUUID().slice(0, 8)}`
  const conversationId = `taskconv_${suffix}`
  const threadId = `taskthread_${suffix}`
  const turnId = `taskmsg_${randomUUID()}`
  const initialUserMessage = buildTaskInitialUserMessage(input)
  const assistantMessageId = `taskmsg_${randomUUID()}`

  ChatContextAPI.createConversation({
    id: conversationId,
    title: input.taskName,
    thread_id: threadId,
  }, {
    activate: false,
    isTitleSet: false,
  })
  const publisher = runEventHub.tryBegin({
    conversationId,
    runId: input.taskLogId,
    turnId,
    assistantMessageId,
    source: 'scheduled_task',
  })
  if (!publisher) {
    return {
      status: 'failed',
      conversationId,
      fileIds: [],
      endReasonCode: TASK_ERROR_CODES.agentExecutionFailed,
    }
  }

  input.onConversationCreated?.(conversationId)

  const abortController = createAbort(input.taskLogId)
  const abortFromTask = () => abortController.abort(input.signal.reason ?? 'Task execution interrupted')
  if (input.signal.aborted) {
    abortFromTask()
  }
  else {
    input.signal.addEventListener('abort', abortFromTask, { once: true })
  }

  try {
    const result = await runConversationTurn({
      message: initialUserMessage,
      conversationId,
      attachmentList: [],
      conversation: {
        id: conversationId,
        title: input.taskName,
        is_title_set: 0,
      },
      signal: abortController.signal,
      publisher,
      fullAccess: true,
      activateConversation: false,
      persistUserMessage: true,
      userMessageMetadata: {
        source: 'task-run',
        taskLogId: input.taskLogId,
      },
      taskMonitor: {
        taskId: input.taskLogId,
        title: input.taskName,
        sourceType: 'task',
      },
      runtime: {
        executionId: input.taskLogId,
        taskMonitorTaskId: input.taskLogId,
        allowedDirIds: input.windows.map(window => window.dirId),
      },
      artifactSource: 'task',
      onUserMessage: (message) => {
        recordTaskExecutionEvent(input.taskLogId, {
          type: 'agent.message.upsert',
          conversationId,
          message: {
            id: message.id,
            role: 'user',
            content: message.content,
            createdAt: new Date(message.createdAt).toISOString(),
          },
        })
      },
      onAssistantDelta: (delta, createdAt) => {
        recordTaskExecutionEvent(input.taskLogId, {
          type: 'agent.message.delta',
          conversationId,
          messageId: assistantMessageId,
          delta,
          createdAt: new Date(createdAt).toISOString(),
        })
      },
      onAssistantMessage: (message) => {
        recordTaskExecutionEvent(input.taskLogId, {
          type: 'agent.message.upsert',
          conversationId,
          message: {
            id: message.id,
            role: 'assistant',
            content: message.content,
            createdAt: new Date(message.createdAt).toISOString(),
          },
        })
      },
      onArtifacts: (artifacts) => {
        recordTaskExecutionEvent(input.taskLogId, {
          type: 'artifacts.updated',
          artifacts: taskArtifacts(artifacts.artifacts.map(artifact => artifact.fileId)),
        })
      },
    })

    return {
      status: result.status,
      conversationId: result.conversationId,
      fileIds: result.fileIds,
      endReasonCode: result.status === 'partial_failed'
        ? TASK_ERROR_CODES.artifactUploadPartialFailure
        : result.status === 'interrupted'
          ? TASK_ERROR_CODES.taskInterrupted
          : result.status === 'failed'
            ? TASK_ERROR_CODES.agentExecutionFailed
            : undefined,
    }
  }
  catch (error) {
    console.error(`[task] Agent task execution failed taskLogId=${input.taskLogId}:`, error)
    const interrupted = abortController.signal.aborted || (error instanceof Error && error.name === 'AbortError')
    return {
      status: interrupted ? 'interrupted' : 'failed',
      conversationId,
      fileIds: [],
      endReasonCode: interrupted ? TASK_ERROR_CODES.taskInterrupted : TASK_ERROR_CODES.agentExecutionFailed,
    }
  }
  finally {
    input.signal.removeEventListener('abort', abortFromTask)
    cleanupRun(input.taskLogId, abortController)
  }
}
