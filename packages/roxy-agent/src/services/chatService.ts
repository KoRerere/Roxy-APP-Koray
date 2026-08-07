import type { AttachmentRef } from './fileService'
import type { RunEventPublisher } from '@/core/agent-events/runEventHub'
import type { CollectedFile } from '@/deepagents/fileCollector'
import type { SqliteSaver } from '@/deepagents/sqlite-checkpointer'
import type { AgentConversationRunStartCommand, AgentRunEvent } from '@roxy/shared/channel'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { Command } from '@langchain/langgraph'
import { randomUUID } from 'node:crypto'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { runEventHub } from '@/core/agent-events/runEventHub'
import { streamEvents } from '@/core/agent-events/streamEvents'
import { isAbortLike, normalizeAgentError } from '@/core/agentError'
import { extToMime, fileManager } from '@/core/fileManager'
import { AbortError, cleanupRun, createAbort } from '@/core/registry/abortRegistry'
import { ConversationRunQueue } from '@/core/registry/conversationRunQueue'
import { cancelInterrupt, createInterruptGate } from '@/core/registry/interruptRegistry'
import { agentPaths } from '@/core/storage/agentPaths'
import { publishTaskMonitorTaskFinished, publishTaskMonitorTaskStarted } from '@/core/task-monitor'
import { ChatContextAPI } from '@/database/conversations'
import { createChatAgent, deleteCheckpoint } from '@/deepagents'
import { conversationCheckpointPath } from '@/deepagents/checkpointPaths'
import { handleWorkerStream, StreamState } from '@/deepagents/handle-stream'
import { closeCheckpointer } from '@/deepagents/sqlite-checkpointer'
import { createLLM } from '@/llm'
import { conversationLogManager } from '@/script/browserOpsManager'
import { env } from '../config'
import { buildMessageContentAsPlainText, hydrateAttachmentFileUrls } from './fileService'

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

export function getConversationDetail(conversationId: string) {
  const conversationDetail = ChatContextAPI.getConversation(conversationId)
  const messages = ChatContextAPI.getMessagesByConversation(conversationId)
  return {
    ...conversationDetail,
    messages,
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
 * 删除对话及其消息、LangGraph checkpoint。返回 false 表示对话不存在。
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
  // 关闭并删除 LangGraph checkpoint（先关句柄，下一步整目录删除才安全）
  await deleteCheckpoint(conversationId)
  // 删除该会话在磁盘上的全部数据目录：sessions/{id}/（含 checkpoint.db、recording 草稿、
  // uploads、artifacts、metadata.json）。此前只删了 checkpoint 文件，导致 session 目录残留。
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
  if (signal?.aborted)
    throw new AbortError('User cancelled')

  const isZh = env.SYSTEM_LANGUAGE === 'zh-CN'
  const llm = await createLLM({
    enableThinking: false,
    conversationId,
    turnId,
    signal,
  })

  if (signal?.aborted)
    throw new AbortError('User cancelled')

  const messageContent = buildMessageContentAsPlainText(userMessage, attachments)

  const structuredLlm = (llm as any).withStructuredOutput(TitleOutputSchema, {
    name: 'generate_title',
  })

  const result = await structuredLlm.invoke([
    new SystemMessage(isZh ? '你是一个专业的对话标题生成助手。' : 'You are a professional conversation title generator.'),
    new HumanMessage(isZh
      ? `请根据用户的第一条消息，为这个对话生成一个简洁、准确的标题。\n\n用户消息：\n${messageContent}`
      : `Please generate a concise, accurate title for this conversation based on the user's first message.\n\nUser message:\n${messageContent}`),
  ], { signal })

  if (signal?.aborted)
    throw new AbortError('User cancelled')

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

function getDisplayFileName(file: CollectedFile): string {
  const source = (file.displayName ?? file.virtualPath).replace(/\\/g, '/')
  return path.posix.basename(source) || 'generated-file'
}

async function publishCollectedFiles(
  files: CollectedFile[],
  streamCallback: (event: AgentRunEvent) => void,
): Promise<void> {
  for (const file of files) {
    const fileName = getDisplayFileName(file)
    const mimeType = extToMime(fileName) ?? 'application/octet-stream'
    try {
      const buffer = await fsPromises.readFile(file.realPath)
      const record = await fileManager.saveBuffer({
        buffer,
        fileName,
        mimeType,
        source: 'generated',
        uploadNow: true,
      })
      streamCallback(streamEvents.agentFile({
        fileId: record.file_id,
        fileName,
        size: record.size ?? buffer.length,
        mimeType,
        op: file.op === 'edit' ? 'update' : 'create',
      }))
    }
    catch (error) {
      console.warn(`Failed to save collected agent file ${file.virtualPath}:`, error)
    }
  }
}

// ---------------------------------------------------------------------------
// C. WebSocket conversation run（含自己独立的 HITL 循环）
// ---------------------------------------------------------------------------

export interface RunConversationTurnOptions {
  message: string
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
  return conversationRunQueue.enqueue(conversationId, async () => {
    try {
      const attachmentList = await hydrateAttachmentFileUrls(command.attachments ?? [], abortController.signal)
      await runConversationTurn({
        message: command.message,
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
        publisher.publish(isAbortLike(error)
          ? streamEvents.cancelled({ message: 'Agent stopped: User cancelled' })
          : streamEvents.error(normalizeAgentError(error)))
      }
    }
    finally {
      cleanupRun(runId, abortController)
    }
  })
}

export async function runConversationTurn(opts: RunConversationTurnOptions): Promise<void> {
  const { message, conversationId, attachmentList, conversation, signal, publisher, fullAccess } = opts
  const streamCallback = (event: AgentRunEvent) => {
    publisher.publish(event)
  }

  ChatContextAPI.setActiveConversation(conversationId)
  const userMessageId = publisher.identity.turnId
  let taskMonitorTitle = conversation.title
  ChatContextAPI.addMessage({
    id: userMessageId,
    conversation_id: conversationId,
    role: 'user',
    content: message || '',
    content_type: 'text',
    storage_type: 'inline',
    metadata: {
      timestamp: Date.now(),
      source: 'api_chat',
      attachments: attachmentList.length > 0 ? attachmentList : undefined,
    },
  })

  await conversationLogManager.ensure(conversationId)

  ChatContextAPI.addMessage({
    id: publisher.identity.assistantMessageId,
    conversation_id: conversationId,
    role: 'assistant',
    content: '',
    content_type: 'file',
    storage_type: 'file',
    file_path: publisher.filePath,
    metadata: {
      timestamp: Date.now(),
      source: 'conversation_run',
      format: 'jsonl',
      runId: publisher.identity.runId,
      turnId: publisher.identity.turnId,
    },
  })

  streamCallback({
    type: 'user_message',
    data: {
      messageId: userMessageId,
      content: message,
      attachments: attachmentList,
      createdAt: Date.now(),
    },
  })

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
        if (isAbortLike(err))
          return
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
    streamCallback(streamEvents.cancelled({ message: 'Agent stopped: User cancelled' }))
    publishTaskMonitorTaskFinished(userMessageId)
    return
  }

  const { agent, destroy, consumeFiles } = await createChatAgent({
    workerId: `chat_${publisher.identity.runId}`,
    conversationId,
    turnId: userMessageId,
    fullAccess,
    onRetry: info => streamCallback(streamEvents.retry(info)),
    signal,
    taskMonitorTaskId: userMessageId,
  })

  const state = new StreamState()
  const flushThinkingTiming = () => {
    const payload = state.finishThinking(Date.now())
    if (payload) {
      streamCallback(streamEvents.thinkingCompleteEvent(payload))
    }
  }

  try {
    const config: any = {
      configurable: {
        thread_id: conversation.thread_id,
        conversationId,
        turnId: userMessageId,
        taskMonitorTaskId: userMessageId,
      },
      conversationId,
      turnId: userMessageId,
      taskMonitorTaskId: userMessageId,
      streamMode: ['messages', 'custom', 'tools', 'updates'],
      signal,
      // 供 parallel_dispatch 工具内将 worker 的 stream 写出到客户端，避免只依赖外层 stream 合并
      writer: streamCallback,
    }

    const messageContent = buildMessageContentAsPlainText(message || '', attachmentList)
    const input = {
      messages: [
        new HumanMessage(messageContent || message || ''),
      ],
      streamCallback,
    }

    // 检查是否有 pending interrupt（用户可能关闭软件后重新打开）
    // 如果有，必须先处理 interrupt，不能接受新消息
    const checkpointer = (agent as any).checkpointer
    let invokeInput: any = input

    if (checkpointer) {
      const checkpointState = await (agent as any).getState(config)
      const hasRealInterrupt = Array.isArray(checkpointState.tasks)
        && checkpointState.tasks.some((t: any) => Array.isArray(t.interrupts) && t.interrupts.length > 0)

      if (hasRealInterrupt) {
        invokeInput = null
      }
      else if (checkpointState.next && checkpointState.next.length > 0) {
        const residualSaver = checkpointer as SqliteSaver
        if (typeof residualSaver.clearPendingWrites === 'function') {
          try {
            residualSaver.clearPendingWrites(conversation.thread_id)
          }
          catch (clearErr) {
            console.warn('Failed to clear pending writes (abort residual):', clearErr)
          }
        }
      }
    }

    // 支持多轮 interrupt：每次 invoke 后检查是否有 __interrupt__，有则等待用户决策后继续
    // 最多重试一次：extended thinking 模式下模型偶发输出空响应（无 text 无 tool_use），自动重试
    let emptyResponseRetries = 0
    while (true) {
      const stream = await (agent as any).stream(invokeInput, config)
      let interrupted = false
      let interruptValue: any = null
      let hasOutput = false

      for await (const rawChunk of stream) {
        const [, chunk] = rawChunk

        // 检测 __interrupt__ 事件（deepagents 通过 custom namespace 推送）
        if (chunk?.__interrupt__) {
          interrupted = true
          interruptValue = chunk.__interrupt__
          continue
        }

        const result = handleWorkerStream(rawChunk, state)
        if (result.length > 0) {
          hasOutput = true
          result.forEach(event => streamCallback(event))
        }
      }

      // extended thinking 模式下模型偶发输出空响应，自动重试一次
      if (!interrupted && !hasOutput && emptyResponseRetries === 0) {
        emptyResponseRetries++
        console.warn('[chat] Empty model response detected, retrying once...')
        continue
      }

      if (!interrupted) {
        break
      }

      const interrupts = interruptValue[0]?.value ?? interruptValue
      const actionRequests = interrupts?.actionRequests ?? []
      const reviewConfigs = interrupts?.reviewConfigs ?? []
      const interruptsId = randomUUID()
      streamCallback(streamEvents.hitlInterrupt({ actionRequests, reviewConfigs, interruptsId }))

      // 等待前端通过 resume 端点提交决策
      const decision = await createInterruptGate(conversationId)
      // 通知前端：该 interruptsId 已被用户处理（approve/reject/edit），便于前端更新 UI 状态
      streamCallback(streamEvents.hitlResume({ interruptsId, decisions: decision.decisions }))
      invokeInput = new Command({ resume: { decisions: decision.decisions } })
    }

    flushThinkingTiming()

    const collectedFiles = consumeFiles?.() ?? []
    if (collectedFiles.length > 0) {
      await publishCollectedFiles(collectedFiles, streamCallback)
    }

    if (signal.aborted) {
      throw new AbortError('User cancelled')
    }

    streamCallback(streamEvents.done())
  }
  catch (error: any) {
    // 清理可能挂起的 interrupt gate
    cancelInterrupt(conversationId)

    flushThinkingTiming()

    // 检查是否是中断错误（用户取消或客户端断开连接）
    if (isAbortLike(error)) {
      // 中断错误，静默处理，不发送错误消息给客户端
      console.log('Chat interrupted by user')

      const checkpointSaver = (agent as any).checkpointer as SqliteSaver | undefined
      if (checkpointSaver && typeof checkpointSaver.clearPendingWrites === 'function') {
        try {
          checkpointSaver.clearPendingWrites(conversation.thread_id)
        }
        catch (clearErr) {
          console.warn('Failed to clear pending writes after interrupt:', clearErr)
        }
      }

      if (!publisher.isTerminal)
        streamCallback(streamEvents.cancelled({ message: 'Agent stopped: User cancelled' }))
    }
    else {
      // 其他错误，归一化为统一错误信封后下发（前端按 code 分支）
      console.error('Error in chat:', error)
      streamCallback(streamEvents.error(normalizeAgentError(error)))
    }
  }
  finally {
    publishTaskMonitorTaskFinished(userMessageId)

    const checkpointer = (agent as any).checkpointer as SqliteSaver | undefined
    try {
      await destroy()
    }
    finally {
      if (checkpointer && conversation?.thread_id) {
        try {
          checkpointer.pruneThreadCheckpoints(conversation.thread_id, 1)
        }
        catch (err) {
          console.warn(`[chat] Failed to prune checkpoints for ${conversation.thread_id}:`, err instanceof Error ? err.message : String(err))
        }
      }

      if (checkpointer) {
        try {
          closeCheckpointer(conversationCheckpointPath(conversationId))
        }
        catch (err) {
          console.warn(`[chat] Failed to close checkpointer for ${conversationId}:`, err instanceof Error ? err.message : String(err))
        }
      }

      try {
        await conversationLogManager.clearSession(conversationId)
      }
      catch (err) {
        console.warn(`[chat] Failed to clear browser ops session for ${conversationId}:`, err instanceof Error ? err.message : String(err))
      }
    }
  }
}
