import type { AttachmentRef } from './fileService'
import type { CollectedFile } from '@/deepagents/fileCollector'
import type { Response } from 'express'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { Command } from '@langchain/langgraph'
import { randomUUID } from 'node:crypto'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { isAbortLike, normalizeAgentError } from '@/core/agentError'
import { extToMime, fileManager } from '@/core/fileManager'
import { cleanupRun } from '@/core/registry/abortRegistry'
import { cancelInterrupt, createInterruptGate } from '@/core/registry/interruptRegistry'
import { sseLoggerManager } from '@/core/sse/sseLogger'
import { streamAdapter } from '@/core/sse/streamAdapter'
import { ChatContextAPI } from '@/database/conversations'
import { createChatAgent, deleteCheckpoint } from '@/deepagents'
import { SqliteSaver } from '@/deepagents/sqlite-checkpointer'
import { handleStream, StreamState } from '@/deepagents/handle-stream'
import { createLLM } from '@/llm'
import { recordingManager } from '@/recording/recordingManager'
import { env } from '../config'
import { buildMessageContent, buildMessageContentAsPlainText } from './fileService'
import { createStreamCallback, initSSEHeaders, resolveSSEFilePath } from './sseStream'

// ---------------------------------------------------------------------------
// A. 会话 / 消息 CRUD 编排（包裹 ChatContextAPI）
// ---------------------------------------------------------------------------

export function createConversation(conversationType?: string) {
  const finalType = conversationType === 'asset' ? 'asset' : 'automation'
  const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  const finalThreadId = `thread_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

  return ChatContextAPI.createConversation({
    id: conversationId,
    title: 'New Chat',
    thread_id: finalThreadId,
    conversation_type: finalType,
  })
}

export function listConversations() {
  return ChatContextAPI.getConversations()
}

export function getConversation(conversationId: string) {
  return ChatContextAPI.getConversation(conversationId)
}

export async function resetConversationRuntime(conversationId: string): Promise<boolean> {
  const conversation = ChatContextAPI.getConversation(conversationId)
  if (!conversation)
    return false

  await deleteCheckpoint(conversationId)
  return true
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
  patch: { title?: string, model?: string, conversationType?: 'asset' | 'automation' },
) {
  return ChatContextAPI.updateConversation(conversationId, {
    title: patch.title,
    model: patch.model,
    conversation_type: patch.conversationType,
  })
}

/**
 * 删除对话及其消息、LangGraph checkpoint。返回 false 表示对话不存在。
 */
export function deleteConversation(conversationId: string): boolean {
  const conversation = ChatContextAPI.getConversation(conversationId)
  if (!conversation) {
    return false
  }

  // 删除对话相关的消息
  ChatContextAPI.deleteMessagesByConversation(conversationId)
  // 删除对话记录
  ChatContextAPI.deleteConversation(conversationId)
  // 删除 LangGraph SQLite checkpoint 中该 thread 的数据
  deleteCheckpoint(conversationId)
  return true
}

export function readFileContent(filePath: string) {
  return fsPromises.readFile(filePath, 'utf-8')
}

// ---------------------------------------------------------------------------
// B. 标题生成（chat 与 image 共用，imageService 复用此函数）
// ---------------------------------------------------------------------------

const TitleOutputSchema = z.object({
  title: z.string().max(20, 'Title must not exceed 20 characters').describe('Conversation title, concise and accurate, no more than 20 characters'),
})

export async function generateConversationTitle(
  userMessage: string,
  attachments: AttachmentRef[],
  conversationId: string,
  turnId: string,
  streamCallback: (event: string) => void,
): Promise<string> {
  const isZh = env.SYSTEM_LANGUAGE === 'zh-CN'
  const llm = await createLLM({
    enableThinking: false,
    conversationId,
    turnId,
  })
  const messageContent = buildMessageContentAsPlainText(userMessage, attachments)

  const structuredLlm = (llm as any).withStructuredOutput(TitleOutputSchema, {
    name: 'generate_title',
  })

  const result = await structuredLlm.invoke([
    new SystemMessage(isZh ? '你是一个专业的对话标题生成助手。' : 'You are a professional conversation title generator.'),
    new HumanMessage(isZh
      ? `请根据用户的第一条消息，为这个对话生成一个简洁、准确的标题。\n\n用户消息：\n${messageContent}`
      : `Please generate a concise, accurate title for this conversation based on the user's first message.\n\nUser message:\n${messageContent}`),
  ])

  const title = result.title.trim()

  // 发送 SSE 事件更新前端
  streamCallback(streamAdapter.title(title))

  return title
}

function resolveChatAgentMode(mode: unknown): 'simple' | 'orchestrator' {
  return mode === 'orchestrator' ? 'orchestrator' : 'simple'
}

function getDisplayFileName(file: CollectedFile): string {
  const source = (file.displayName ?? file.virtualPath).replace(/\\/g, '/')
  return path.posix.basename(source) || 'generated-file'
}

async function publishCollectedFiles(
  files: CollectedFile[],
  streamCallback: (event: string) => void,
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
      streamCallback(streamAdapter.agentFile({
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
// C. /chat 流式主流程（含自己独立的 HITL 循环）
// ---------------------------------------------------------------------------

export interface RunChatStreamOptions {
  message?: string
  conversationId: string
  mode?: unknown
  multimodalAttachments?: boolean
  attachmentList: AttachmentRef[]
  conversation: any
  signal: AbortSignal
  res: Response
  /** 完全访问模式（yolo）：开启后本次会话跳过 HITL，所有操作直接执行。 */
  fullAccess?: boolean
}

/**
 * 运行一次 /chat 流式对话：落消息 → 标题 → 创建 agent → HITL 循环 → 清理。
 * 调用方（路由）已完成入参校验、附件注水、对话存在性检查与 abort 注册。
 */
export async function runChatStream(opts: RunChatStreamOptions): Promise<void> {
  const { message, conversationId, mode, multimodalAttachments, attachmentList, conversation, signal, res, fullAccess } = opts

  // 自动设置为活跃对话
  ChatContextAPI.setActiveConversation(conversationId)

  initSSEHeaders(res)

  // 添加用户消息到对话历史
  const agentMode = resolveChatAgentMode(mode)
  const userMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  ChatContextAPI.addMessage({
    id: userMessageId,
    conversation_id: conversationId,
    role: 'user',
    content: message || '',
    content_type: 'text',
    storage_type: 'inline',
    agent_mode: agentMode,
    metadata: {
      timestamp: Date.now(),
      source: 'api_chat',
      attachments: attachmentList.length > 0 ? attachmentList : undefined,
    },
  })

  // 如果正在录制，追加用户消息（意图上下文）
  if (message && recordingManager.isRecording(conversationId)) {
    recordingManager.appendUserMessage(conversationId, message)
  }

  const { fileName, sseFilePath } = resolveSSEFilePath()

  ChatContextAPI.addMessage({
    id: fileName,
    conversation_id: conversationId,
    role: 'assistant',
    content: '',
    content_type: 'file',
    storage_type: 'file',
    file_path: sseFilePath,
    agent_mode: agentMode,
    metadata: {
      timestamp: Date.now(),
      source: 'sse_stream',
    },
  })

  const sseLogger = sseLoggerManager.createLogger(sseFilePath)
  let orchestratorStoppedSent = false

  const streamCallback = createStreamCallback(res, sseLogger, {
    onEvent: (parsed) => {
      if (parsed?.type === 'orchestrator_stopped') {
        orchestratorStoppedSent = true
      }
    },
  })

  // 先把会话开始标识写入
  streamCallback(streamAdapter.session(conversation.thread_id))

  // 如果标题还没有设置，就生成标题
  if (conversation.is_title_set === 0 || conversation.is_title_set === undefined) {
    await generateConversationTitle(message || '', attachmentList, conversationId, userMessageId, streamCallback)
      .then((generatedTitle) => {
        if (generatedTitle) {
          ChatContextAPI.updateConversation(conversationId, { title: generatedTitle })
        }
      })
      .catch((err) => {
        console.error('Failed to generate title:', err)
      })
  }

  const { agent, destroy, consumeFiles } = await createChatAgent({
    mode: agentMode,
    conversationId,
    turnId: userMessageId,
    fullAccess,
    onRetry: info => streamCallback(streamAdapter.retry(info)),
  })

  const state = new StreamState()
  const flushThinkingTiming = () => {
    const payload = state.finishThinking(Date.now())
    if (payload) {
      streamCallback(streamAdapter.thinkingComplete(payload))
    }
  }

  try {
    const config: any = {
      configurable: {
        thread_id: conversation.thread_id,
      },
      conversationId,
      turnId: userMessageId,
      streamMode: ['messages', 'custom', 'tools', 'updates'],
      signal,
      // 供 parallel_dispatch 工具内将 worker 的 stream 写出到客户端，避免只依赖外层 stream 合并
      writer: streamCallback,
    }

    const useMultimodalAttachments = multimodalAttachments === true
    const messageContent = useMultimodalAttachments
      ? await buildMessageContent(message || '', attachmentList)
      : buildMessageContentAsPlainText(message || '', attachmentList)
    const input = {
      messages: [
        Array.isArray(messageContent)
          ? new HumanMessage({ content: messageContent })
          : new HumanMessage(messageContent || message || ''),
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
    while (true) {
      const stream = await (agent as any).stream(invokeInput, config)
      let interrupted = false
      let interruptValue: any = null

      for await (const rawChunk of stream) {
        const [, chunk] = rawChunk

        // 检测 __interrupt__ 事件（deepagents 通过 custom namespace 推送）
        if (chunk?.__interrupt__) {
          interrupted = true
          interruptValue = chunk.__interrupt__
          continue
        }

        const result = handleStream(rawChunk, state)
        if (Array.isArray(result)) {
          result.forEach(event => streamCallback(event))
        }
        else if (result) {
          streamCallback(typeof result === 'object' ? JSON.stringify(result) : result)
        }
      }

      if (!interrupted) {
        break
      }

      // 提取 interrupt 信息并推送给前端，SSE 连接保持打开
      const interrupts = interruptValue[0]?.value ?? interruptValue
      const actionRequests = interrupts?.actionRequests ?? []
      const reviewConfigs = interrupts?.reviewConfigs ?? []
      const interruptsId = randomUUID()
      streamCallback(streamAdapter.hitlInterrupt({ actionRequests, reviewConfigs, interruptsId }))

      // 等待前端通过 resume 端点提交决策
      const decision = await createInterruptGate(conversationId)
      // 通知前端：该 interruptsId 已被用户处理（approve/reject/edit），便于前端更新 UI 状态
      streamCallback(streamAdapter.hitlResume({ interruptsId, decisions: decision.decisions }))
      invokeInput = new Command({ resume: { decisions: decision.decisions } })
    }

    flushThinkingTiming()

    const collectedFiles = consumeFiles?.() ?? []
    if (collectedFiles.length > 0) {
      await publishCollectedFiles(collectedFiles, streamCallback)
    }

    streamCallback(streamAdapter.done())
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

      if (!orchestratorStoppedSent) {
        streamCallback(streamAdapter.orchestratorStopped({
          status: 'failed',
          reason: 'user',
          message: 'Orchestrator stopped: User cancelled',
        }))
      }
      streamCallback(streamAdapter.interrupt(error.message))
    }
    else {
      // 其他错误，归一化为统一错误信封后下发（前端按 code 分支）
      console.error('Error in chat:', error)
      streamCallback(streamAdapter.error(normalizeAgentError(error)))
    }
  }
  finally {
    await destroy()
    cleanupRun(conversationId)

    // 清理统计器资源
    sseLoggerManager.closeLogger(sseFilePath)
  }
}
