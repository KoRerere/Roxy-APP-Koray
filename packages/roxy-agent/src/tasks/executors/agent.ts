import type { ResolvedTaskWindow, TaskExecutorResult } from '../types'
import type { ResolvedTemplate } from '@/services/templateService'
import type { TemplateRef } from '@roxy/shared'
import type { AgentRunEvent } from '@roxy/shared/channel'
import { HumanMessage } from '@langchain/core/messages'
import {
  serializeAgentProfileReference,
  serializeAgentSkillReference,
} from '@roxy/shared'
import { randomUUID } from 'node:crypto'
import { runEventHub } from '@/core/agent-events/runEventHub'
import { streamEvents } from '@/core/agent-events/streamEvents'
import { normalizeAgentError } from '@/core/agentError'
import { t } from '@/core/i18n'
import { cleanupRun, createAbort } from '@/core/registry/abortRegistry'
import { publishTaskMonitorTaskFinished, publishTaskMonitorTaskStarted } from '@/core/task-monitor'
import { ChatContextAPI } from '@/database/conversations'
import { createChatAgent } from '@/deepagents/agent/chat'
import { handleWorkerStream, StreamState } from '@/deepagents/handle-stream'
import { generateConversationTitle } from '@/services/chatService'
import { persistTaskArtifacts } from '@/services/taskArtifacts'
import {
  recordTaskExecutionEvent,
  taskArtifacts,
} from '@/services/taskExecutionDetails'
import { ensureResolvedTemplateSkillInstalled } from '@/services/templateService'
import { TASK_ERROR_CODES } from '../errorCodes'
import { collectedFiles } from '../types'

const TASK_AGENT_DESTROY_TIMEOUT_MS = 12_000

export interface PreparedTaskSkill {
  ref: TemplateRef
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
  return { ref: installed.ref }
}

export function buildTaskInitialUserMessage(input: AgentTaskExecutionInput): string {
  const parts: string[] = []
  if (input.skill) {
    parts.push(serializeAgentSkillReference(input.templateName, input.skill.ref))
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
  const userMessageCreatedAt = new Date().toISOString()
  const assistantMessageId = `taskmsg_${randomUUID()}`
  const assistantMessageCreatedAt = new Date().toISOString()
  const events: AgentRunEvent[] = []
  let destroy: (() => Promise<void>) | undefined

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

  ChatContextAPI.addMessage({
    id: turnId,
    conversation_id: conversationId,
    role: 'user',
    content: initialUserMessage,
    content_type: 'text',
    storage_type: 'inline',
    metadata: { source: 'task-run', taskLogId: input.taskLogId },
  })
  ChatContextAPI.addMessage({
    id: assistantMessageId,
    conversation_id: conversationId,
    role: 'assistant',
    content: '',
    content_type: 'file',
    storage_type: 'file',
    file_path: publisher.filePath,
    metadata: {
      source: 'conversation_run',
      format: 'jsonl',
      taskLogId: input.taskLogId,
      runId: input.taskLogId,
      turnId,
    },
  })
  publisher.publish({
    type: 'user_message',
    data: {
      messageId: turnId,
      content: initialUserMessage,
      attachments: [],
      createdAt: Date.now(),
    },
  })
  input.onConversationCreated?.(conversationId)
  recordTaskExecutionEvent(input.taskLogId, {
    type: 'agent.message.upsert',
    conversationId,
    message: {
      id: turnId,
      role: 'user',
      content: initialUserMessage,
      createdAt: userMessageCreatedAt,
    },
  })
  publishTaskMonitorTaskStarted({
    taskId: input.taskLogId,
    title: input.taskName,
    sourceType: 'task',
    conversationId,
    runId: input.taskLogId,
  })

  const abortController = createAbort(input.taskLogId)
  const abortFromTask = () => abortController.abort(input.signal.reason ?? 'Task execution interrupted')
  if (input.signal.aborted)
    abortFromTask()
  else
    input.signal.addEventListener('abort', abortFromTask, { once: true })

  try {
    await generateConversationTitle(initialUserMessage, [], conversationId, turnId, event => publisher.publish(event), abortController.signal)
      .then((title) => {
        if (title)
          ChatContextAPI.updateConversation(conversationId, { title, is_title_set: 1 })
      })
      .catch((error) => {
        if (!abortController.signal.aborted)
          console.warn(`[task] Failed to generate task conversation title ${input.taskLogId}:`, error)
      })

    const instance = await createChatAgent({
      workerId: `task_${input.taskLogId}`,
      conversationId,
      turnId,
      fullAccess: true,
      signal: abortController.signal,
      taskMonitorTaskId: input.taskLogId,
      allowedDirIds: input.windows.map(window => window.dirId),
    })
    destroy = instance.destroy
    const state = new StreamState()

    const stream = await instance.agent.stream(
      { messages: [new HumanMessage(initialUserMessage)] },
      {
        configurable: { thread_id: threadId },
        conversationId,
        turnId,
        taskMonitorTaskId: input.taskLogId,
        streamMode: ['messages', 'custom', 'tools'],
        signal: abortController.signal,
        writer: (event: AgentRunEvent) => publisher.publish(event),
      } as any,
    )
    for await (const rawChunk of stream) {
      const nextEvents = handleWorkerStream(rawChunk, state)
      events.push(...nextEvents)
      for (const event of nextEvents) {
        publisher.publish(event)
        if (event.type !== 'content_delta' || event.data.workerId) {
          continue
        }

        const contentId = event.data.contentId
        if (!contentId || !event.data.text)
          continue

        recordTaskExecutionEvent(input.taskLogId, {
          type: 'agent.message.delta',
          conversationId,
          messageId: assistantMessageId,
          delta: event.data.text,
          createdAt: assistantMessageCreatedAt,
        })
      }
    }

    if (abortController.signal.aborted) {
      throw abortController.signal.reason instanceof Error
        ? abortController.signal.reason
        : new DOMException('Task execution was interrupted', 'AbortError')
    }

    const assistantMessages = collectTaskAssistantMessages(events)
    if (assistantMessages.length === 0) {
      const fallbackContent = state.getLastChunkContent().trim()
      if (fallbackContent)
        assistantMessages.push({ contentId: 'fallback', content: fallbackContent })
    }
    const finalContent = assistantMessages.map(message => message.content).join('\n\n')
    recordTaskExecutionEvent(input.taskLogId, {
      type: 'agent.message.upsert',
      conversationId,
      message: {
        id: assistantMessageId,
        role: 'assistant',
        content: finalContent,
        createdAt: assistantMessageCreatedAt,
      },
    })

    const artifacts = await persistTaskArtifacts(collectedFiles(instance.consumeFiles?.() ?? []))
    recordTaskExecutionEvent(input.taskLogId, {
      type: 'artifacts.updated',
      artifacts: taskArtifacts(artifacts.fileIds),
    })
    if (artifacts.failedFiles.length > 0) {
      publisher.publish(streamEvents.done(finalContent))
      return {
        status: 'partial_failed',
        conversationId,
        fileIds: artifacts.fileIds,
        endReasonCode: TASK_ERROR_CODES.artifactUploadPartialFailure,
      }
    }
    publisher.publish(streamEvents.done(finalContent))
    return { status: 'success', conversationId, fileIds: artifacts.fileIds }
  }
  catch (error) {
    const interrupted = abortController.signal.aborted
      || (error instanceof Error && error.name === 'AbortError')
    console.error(`[task] Agent task execution failed taskLogId=${input.taskLogId}:`, error)
    const errorCode = interrupted
      ? TASK_ERROR_CODES.taskInterrupted
      : TASK_ERROR_CODES.agentExecutionFailed
    const message = interrupted
      ? t('任务执行已中断')
      : t('任务执行失败，请稍后重试')

    recordTaskExecutionEvent(input.taskLogId, {
      type: 'agent.message.upsert',
      conversationId,
      message: {
        id: assistantMessageId,
        role: 'assistant',
        content: message,
        createdAt: assistantMessageCreatedAt,
      },
    })
    publisher.publish(interrupted
      ? streamEvents.cancelled({ message })
      : streamEvents.error(normalizeAgentError(error)))
    return {
      status: interrupted ? 'interrupted' : 'failed',
      conversationId,
      fileIds: [],
      endReasonCode: errorCode,
    }
  }
  finally {
    input.signal.removeEventListener('abort', abortFromTask)
    publishTaskMonitorTaskFinished(input.taskLogId)
    if (destroy) {
      await Promise.race([
        destroy(),
        new Promise<void>(resolve => setTimeout(resolve, TASK_AGENT_DESTROY_TIMEOUT_MS)),
      ]).catch(error => console.warn(`[task] Failed to destroy task agent ${input.taskLogId}:`, error))
    }
    cleanupRun(input.taskLogId, abortController)
  }
}
