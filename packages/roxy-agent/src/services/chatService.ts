import type { AttachmentRef } from './fileService'
import type { RunEventPublisher } from '@/core/agent-events/runEventHub'
import type { RuntimeCollectedFile } from '@/runtime/file-collector'
import type { AgentConversationRunStartCommand, AgentRunEvent } from '@roxy/shared/channel'
import type { RolloutArtifact, RolloutArtifactSource } from 'roxy-agent-runtime'
import { randomUUID } from 'node:crypto'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { withAgentPath } from '@/core/agent-events/events'
import { projectMessagesFromRollout } from '@/core/agent-events/rolloutHistory'
import { runEventHub } from '@/core/agent-events/runEventHub'
import { streamEvents } from '@/core/agent-events/streamEvents'
import { isAbortLike, normalizeAgentError } from '@/core/agentError'
import { fileManager, generatedArtifactMimeType } from '@/core/fileManager'
import { mcpManager } from '@/core/mcp/mcpManager'
import { AbortError, cleanupRun, createAbort } from '@/core/registry/abortRegistry'
import { ConversationRunQueue } from '@/core/registry/conversationRunQueue'
import { executionCenter } from '@/core/registry/executionCenter'
import { cancelInterrupt, createInterruptGate } from '@/core/registry/interruptRegistry'
import { agentPaths } from '@/core/storage/agentPaths'
import { publishTaskMonitorTaskFinished, publishTaskMonitorTaskStarted } from '@/core/task-monitor'
import { ChatContextAPI } from '@/database/conversations'
import { browserOpsManager } from '@/script/browserOpsManager'
import { env } from '../config'
import { createRuntimeChatAgent } from '../runtime'
import { RuntimeEventPublisher } from '../runtime/event-publisher'
import { createRuntimeProvider } from '../runtime/provider'
import { RoxyRolloutStore } from '../runtime/rollout'
import { paginateConversationMessages } from './conversationMessagePagination'
import { buildConversationTitlePrompt } from './conversationTitle'
import {
  buildLocalAttachmentContent,
  buildMessageContentAsPlainText,
  buildNonImageAttachmentContent,
  buildUserMessageContent,
  hydrateAttachmentFileUrls,
} from './fileService'
import { preloadSkillMarkdownLinks } from './skillMarkdownResolver'

const conversationRunQueue = new ConversationRunQueue()

// ---------------------------------------------------------------------------
// A. 会话 / 消息 CRUD 编排（包裹 ChatContextAPI）
// ---------------------------------------------------------------------------

export function createConversation() {
  const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  const finalThreadId = `thread_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

  return ChatContextAPI.createConversation({
    id: conversationId,
    title: 'New Chat',
    thread_id: finalThreadId,
  })
}

export interface ListConversationsOptions {
  limit: number
  offset: number
}

export function listConversations(options: ListConversationsOptions) {
  return ChatContextAPI.getConversationPage(options.limit, options.offset)
}

export function getConversation(conversationId: string) {
  return ChatContextAPI.getConversation(conversationId)
}

export function getConversationDetail(
  conversationId: string,
  options: { cursor?: string, limit: number },
) {
  const conversationDetail = ChatContextAPI.getConversation(conversationId)
  const rolloutMessages = projectMessagesFromRollout(conversationId, {
    latestRunId: conversationDetail?.latest_run_id,
    latestRunStatus: conversationDetail?.latest_run_status,
    source: conversationId.startsWith('taskconv_') ? 'scheduled_task' : 'user',
    excludeActiveTurn: conversationDetail?.latest_run_status === 'streaming',
  })
  const page = paginateConversationMessages(rolloutMessages, options)
  return {
    ...conversationDetail,
    ...page,
  }
}

export function updateConversation(
  conversationId: string,
  patch: { title?: string, isTitleSet?: boolean },
) {
  const isTitleSet = patch.isTitleSet === undefined
    ? undefined
    : Number(patch.isTitleSet) as 0 | 1

  return ChatContextAPI.updateConversation(conversationId, {
    title: patch.title,
    is_title_set: isTitleSet,
  })
}

export function markConversationRead(conversationId: string, runId: string) {
  const conversation = ChatContextAPI.getConversation(conversationId)
  if (!conversation) {
    return null
  }

  ChatContextAPI.markConversationRead(conversationId, runId)
  return ChatContextAPI.getConversation(conversationId)
}

/**
 * 删除对话及其 runtime rollout、消息和产物。返回 false 表示对话不存在。
 */
export async function deleteConversation(conversationId: string): Promise<boolean> {
  const conversation = ChatContextAPI.getConversation(conversationId)
  if (!conversation) {
    return false
  }

  // 清理该对话在消息 metadata 中引用的上传附件。按 hash 引用计数，不误删共享文件。
  try {
    fileManager.deleteConversationFiles(conversationId)
  }
  catch (err: any) {
    console.warn(`清理会话附件失败 ${conversationId}:`, err?.message)
  }
  // 删除对话相关的消息（内部会一并清理 JSONL 事件文件）
  ChatContextAPI.deleteMessagesByConversation(conversationId)
  // 删除对话记录
  ChatContextAPI.deleteConversation(conversationId)
  mcpManager.forgetConversation(conversationId)
  // runtime rollout、recording、uploads、artifacts、metrics 全部位于 session 目录中。
  try {
    await fsPromises.rm(agentPaths.sessionDir(conversationId), { recursive: true, force: true })
  }
  catch (err: any) {
    console.warn(`删除会话目录失败 ${conversationId}:`, err?.message)
  }
  return true
}

// ---------------------------------------------------------------------------
// B. 标题生成（会话与图片工具共用）
// ---------------------------------------------------------------------------

const TitleOutputSchema = z.object({
  title: z.string().max(20, 'Title must not exceed 20 characters').describe('Conversation title, concise and accurate, no more than 20 characters'),
})

export async function generateConversationTitle(
  userMessage: string,
  attachments: AttachmentRef[],
  conversationId: string,
  turnId: string,
  streamCallback: (event: AgentRunEvent) => void,
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) {
    throw new AbortError('User cancelled')
  }

  const provider = await createRuntimeProvider({
    conversationId,
    turnId,
    signal,
    onRetry: event => streamCallback(withAgentPath(streamEvents.retryEvent(event), '/root')),
  })

  if (signal?.aborted) {
    throw new AbortError('User cancelled')
  }

  const messageContent = buildMessageContentAsPlainText(userMessage, attachments)

  const structuredLlm = provider.withStructuredOutput(TitleOutputSchema, { name: 'generate_title', method: 'jsonSchema' })

  const result = await structuredLlm(buildConversationTitlePrompt({
    messageContent,
    systemLanguage: env.SYSTEM_LANGUAGE,
  }), signal)

  if (signal?.aborted) {
    throw new AbortError('User cancelled')
  }

  const title = result.title.trim()
  streamCallback(streamEvents.title(title))
  return title
}

function resolveTaskMonitorTitle(title: string | undefined): string {
  const trimmed = title?.trim()
  if (!trimmed) {
    return 'Agent task'
  }
  return trimmed.length > 64 ? `${trimmed.slice(0, 64)}...` : trimmed
}

function getDisplayFileName(file: RuntimeCollectedFile): string {
  const source = (file.displayName ?? file.virtualPath).replace(/\\/g, '/')
  return path.posix.basename(source) || 'generated-file'
}

async function publishCollectedFiles(
  files: RuntimeCollectedFile[],
  streamCallback: (event: AgentRunEvent) => void,
): Promise<RolloutArtifact[]> {
  const artifacts: RolloutArtifact[] = []
  for (const file of files) {
    const fileName = getDisplayFileName(file)
    const mimeType = generatedArtifactMimeType(fileName)
    if (!mimeType) {
      console.warn(`Skipping unsupported generated artifact ${file.virtualPath}`)
      continue
    }
    try {
      const buffer = await fsPromises.readFile(file.realPath)
      const record = await fileManager.saveBuffer({
        buffer,
        fileName,
        mimeType,
        source: 'generated',
        uploadNow: true,
      })
      const operation = file.op === 'edit' ? 'update' : 'create'
      streamCallback(streamEvents.agentFile({
        fileId: record.file_id,
        fileName,
        size: record.size ?? buffer.length,
        mimeType,
        op: operation,
      }))
      artifacts.push({
        fileId: record.file_id,
        fileName,
        size: record.size ?? buffer.length,
        mimeType,
        operation,
        source: normalizeArtifactSource(file),
        virtualPath: file.virtualPath,
        localPath: file.realPath,
        displayName: file.displayName,
        toolName: file.toolName,
        toolUseId: file.toolUseId,
        workerId: file.workerId,
        agentPath: file.agentPath ?? '/root',
      })
    }
    catch (error) {
      console.warn(`Failed to save collected agent file ${file.virtualPath}:`, error)
    }
  }
  return artifacts
}

function normalizeArtifactSource(file: RuntimeCollectedFile): RolloutArtifactSource {
  if (typeof file.source === 'string' && file.source.length > 0) {
    return file.source
  }
  return 'apply_patch'
}

async function appendCollectedArtifactsToRollout(
  conversationId: string,
  artifacts: RolloutArtifact[],
): Promise<void> {
  if (artifacts.length === 0) {
    return
  }
  const rollout = new RoxyRolloutStore(
    path.dirname(agentPaths.sessionDir(conversationId)),
    sessionId => agentPaths.sessionRollout(sessionId),
  )
  await rollout.append(conversationId, {
    type: 'artifacts_collected',
    artifacts,
  })
}

// ---------------------------------------------------------------------------
// C. WebSocket conversation run（含自己独立的 HITL 循环）
// ---------------------------------------------------------------------------

export interface RunConversationTurnOptions {
  message: string
  localAttachments?: AgentConversationRunStartCommand['localAttachments']
  conversationId: string
  attachmentList: AttachmentRef[]
  conversation: any
  signal: AbortSignal
  publisher: RunEventPublisher
  fullAccess?: boolean
}

export function startConversationRun(
  command: AgentConversationRunStartCommand,
  requestId: string,
): Promise<void> {
  const { conversationId } = command
  if (runEventHub.isActive(conversationId)) {
    return Promise.resolve()
  }

  const conversation = getConversation(conversationId)
  if (!conversation) {
    return Promise.resolve()
  }

  const suffix = `${Date.now()}_${randomUUID().slice(0, 8)}`
  const turnId = `msg_${suffix}`
  const runId = `run_${suffix}`
  const assistantMessageId = `msg_${Date.now()}_${randomUUID().slice(0, 8)}`
  const publisher = runEventHub.tryBegin({
    conversationId,
    runId,
    turnId,
    assistantMessageId,
    requestId,
    source: 'user',
  })
  if (!publisher) {
    return Promise.resolve()
  }

  const abortController = createAbort(runId)
  executionCenter.register({
    id: runId,
    source: 'conversation',
    conversationId,
    title: conversation.title,
    cancel: () => {
      abortController.abort('User cancelled')
      return true
    },
  })
  executionCenter.start(runId)
  return conversationRunQueue.enqueue(conversationId, async () => {
    try {
      const attachmentList = await hydrateAttachmentFileUrls(command.attachments ?? [], abortController.signal)
      await runConversationTurn({
        message: command.message,
        localAttachments: command.localAttachments,
        conversationId,
        attachmentList,
        conversation,
        signal: abortController.signal,
        publisher,
        fullAccess: command.fullAccess,
      })
    }
    catch (error) {
      if (!publisher.isTerminal) {
        publisher.publish(withAgentPath(isAbortLike(error)
          ? streamEvents.cancelled({ message: 'Agent stopped: User cancelled' })
          : streamEvents.error(normalizeAgentError(error)), '/root'))
      }
    }
    finally {
      executionCenter.finish(runId, publisher.terminalStatus ?? (abortController.signal.aborted ? 'cancelled' : 'failed'))
      cleanupRun(runId, abortController)
    }
  })
}

export async function runConversationTurn(opts: RunConversationTurnOptions): Promise<void> {
  const {
    message,
    localAttachments,
    conversationId,
    attachmentList,
    conversation,
    signal,
    publisher,
    fullAccess,
  } = opts
  const streamCallback = (event: AgentRunEvent) => {
    const data = event.data as { agentPath?: unknown }
    publisher.publish(typeof data.agentPath === 'string' && data.agentPath.length > 0 ? event : withAgentPath(event, '/root'))
  }

  ChatContextAPI.setActiveConversation(conversationId)
  const userMessageId = publisher.identity.turnId
  let taskMonitorTitle = conversation.title

  await browserOpsManager.ensure(conversationId)

  ChatContextAPI.addMessage({
    id: publisher.identity.assistantMessageId,
    conversation_id: conversationId,
    role: 'assistant',
    content: '',
    content_type: 'text',
    storage_type: 'inline',
    metadata: {
      timestamp: Date.now(),
      source: 'conversation_run',
      runId: publisher.identity.runId,
      turnId: publisher.identity.turnId,
    },
  })

  streamCallback(withAgentPath({
    type: 'user_message',
    data: {
      messageId: userMessageId,
      content: message,
      attachments: attachmentList,
      createdAt: Date.now(),
    },
  }, '/root'))

  // 如果标题还没有设置，就生成标题
  if (conversation.is_title_set === 0 || conversation.is_title_set === undefined) {
    await generateConversationTitle(message || '', attachmentList, conversationId, userMessageId, streamCallback, signal)
      .then((generatedTitle) => {
        if (generatedTitle) {
          updateConversation(conversationId, { title: generatedTitle, isTitleSet: true })
          taskMonitorTitle = generatedTitle
        }
      })
      .catch((err) => {
        if (isAbortLike(err)) {
          return
        }
        console.error('Failed to generate title:', err)
      })
  }

  publishTaskMonitorTaskStarted({
    taskId: userMessageId,
    title: resolveTaskMonitorTitle(taskMonitorTitle),
    sourceType: 'chat',
    conversationId,
    runId: publisher.identity.runId,
  })

  if (signal.aborted) {
    streamCallback(withAgentPath(streamEvents.cancelled({ message: 'Agent stopped: User cancelled' }), '/root'))
    publishTaskMonitorTaskFinished(userMessageId)
    return
  }

  // Keep the publisher alive before agent creation so retry callbacks can
  // discard partial text before the next replacement stream is handled.
  const runtimePublisher = new RuntimeEventPublisher(streamCallback, { emitDone: false, agentPath: '/root' })
  const { agent, createInput, destroy, consumeFiles, setFullAccess } = await createRuntimeChatAgent({
    conversationId,
    executionId: publisher.identity.runId,
    runId: publisher.identity.runId,
    turnId: userMessageId,
    fullAccess,
    signal,
    taskMonitorTaskId: userMessageId,
    writer: streamCallback,
    retryHandler: () => runtimePublisher.markRetryPending(),
  })

  try {
    const messageContent = buildMessageContentAsPlainText(message || '', attachmentList)
    const userMessageContent = buildUserMessageContent(message || '', attachmentList, localAttachments)
    const attachmentContent = [
      buildNonImageAttachmentContent(attachmentList),
      buildLocalAttachmentContent(localAttachments),
    ].filter(Boolean).join('\n\n')
    await preloadSkillMarkdownLinks(messageContent || message || '', signal)
      .then((result) => {
        if (result.errors.length > 0) {
          console.warn('[chat] Failed to preload selected Skill markdown links:', result.errors)
        }
      })
      .catch((error) => {
        console.warn('[chat] Failed to parse selected Skill markdown links:', error)
      })
    let terminalStopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | 'pause_turn' = 'end_turn'
    // Publish the terminal event only after post-stream artifacts are flushed.
    // No event may arrive after run_completed/run_failed/run_cancelled.
    const trailingMessages = attachmentContent
      ? [{ role: 'user' as const, content: attachmentContent, visible: false }]
      : []
    for await (const event of agent.stream(createInput(userMessageContent, trailingMessages), signal)) {
      runtimePublisher.handle(event)
      if (event.type === 'done') {
        terminalStopReason = event.stopReason
      }
      if (event.type === 'hitl_pending') {
        executionCenter.setStatus(publisher.identity.runId, 'waiting')
        const decision = await createInterruptGate(conversationId)
        if (decision.fullAccess) {
          setFullAccess()
        }
        const first = decision.decisions[0]
        agent.resume(event.pending.traceId, {
          decision: first?.type === 'reject' ? 'reject' : 'approve',
          feedback: first && 'reason' in first ? first.reason : undefined,
        })
        executionCenter.start(publisher.identity.runId)
        streamCallback(streamEvents.hitlResume({ interruptsId: event.pending.traceId, decisions: decision.decisions }))
      }
      else if (event.type === 'clarification_pending') {
        executionCenter.setStatus(publisher.identity.runId, 'waiting')
        const decision = await createInterruptGate(conversationId)
        const first = decision.decisions[0]
        const answer = first?.type === 'answer' ? first.answer : ''
        agent.clarify(event.pending.traceId, { answer })
        executionCenter.start(publisher.identity.runId)
        streamCallback(streamEvents.hitlResume({ interruptsId: event.pending.traceId, decisions: decision.decisions }))
      }
    }

    const collectedFiles = consumeFiles?.() ?? []
    if (collectedFiles.length > 0) {
      const artifacts = await publishCollectedFiles(collectedFiles, streamCallback)
      await appendCollectedArtifactsToRollout(conversationId, artifacts)
    }

    if (signal.aborted) {
      throw new AbortError('User cancelled')
    }

    streamCallback(withAgentPath(
      terminalStopReason === 'max_tokens'
        ? streamEvents.error('Model output was truncated before the assistant could finish. Please retry with a shorter response or smaller tool input.')
        : streamEvents.done(runtimePublisher.getFinalAnswer()),
      '/root',
    ))
  }
  catch (error: any) {
    // 清理可能挂起的 interrupt gate
    cancelInterrupt(conversationId)
    // A provider failure can happen before runtime emits done. Close any
    // open thinking block before publishing the terminal run event.
    runtimePublisher.finishOpenThinking()

    // 检查是否是中断错误（用户取消或客户端断开连接）
    if (isAbortLike(error)) {
      // 中断错误，静默处理，不发送错误消息给客户端
      console.log('Chat interrupted by user')

      if (!publisher.isTerminal) {
        streamCallback(withAgentPath(streamEvents.cancelled({ message: 'Agent stopped: User cancelled' }), '/root'))
      }
    }
    else {
      // 其他错误，归一化为统一错误信封后下发（前端按 code 分支）
      console.error('Error in chat:', error)
      streamCallback(withAgentPath(streamEvents.error(normalizeAgentError(error)), '/root'))
    }
  }
  finally {
    publishTaskMonitorTaskFinished(userMessageId)

    try {
      await destroy()
    }
    finally {
      try {
        await browserOpsManager.clearSession(conversationId)
      }
      catch (err) {
        console.warn(`[chat] Failed to clear browser ops session for ${conversationId}:`, err instanceof Error ? err.message : String(err))
      }
    }
  }
}
