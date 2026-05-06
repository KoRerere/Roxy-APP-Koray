import type { Request, Response } from 'express'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { Router } from 'express'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { AbortError, abortRun, createAbort } from '../abortRegistry'
import { env } from '../config'
import { ChatContextAPI } from '../database/conversations'
import { createAgent, deleteCheckpoint } from '../deepagents'
import { handleStream, StreamState } from '../deepagents/handle-stream'
import { isWorkerStart } from '../deepagents/tools'
import { createLLM } from '../llm'
import { mcpManager } from '../mcpManager'
import { sseLoggerManager } from './sseLogger'
import { streamAdapter } from './streamAdapter'

// 附件文件存储目录
const uploadsDir = path.join(env.CHECKPOINT_DIR, 'uploads')

let _dirsInitialized = false
/**
 * 初始化路由所需目录（sse、uploads），幂等，由 server/index.ts 的 createApp() 调用
 */
export function initChatRouteDirs() {
  if (_dirsInitialized)
    return
  if (!fs.existsSync(path.join(env.CHECKPOINT_DIR, 'sse')))
    fs.mkdirSync(path.join(env.CHECKPOINT_DIR, 'sse'), { recursive: true })
  if (!fs.existsSync(uploadsDir))
    fs.mkdirSync(uploadsDir, { recursive: true })
  _dirsInitialized = true
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'application/pdf',
  'text/plain',
])

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
}

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
}

/**
 * 5MB
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024

const router: Router = Router()

// 上传附件文件
router.post('/upload', (req: Request, res: Response) => {
  try {
    const { data, mimeType, fileName } = req.body

    if (!data || !mimeType || !fileName) {
      return res.json({ code: 1, msg: 'data, mimeType and fileName are required' })
    }

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return res.json({ code: 1, msg: `Unsupported file type: ${mimeType}` })
    }

    const buffer = Buffer.from(data, 'base64')
    if (buffer.length > MAX_FILE_SIZE) {
      return res.json({ code: 1, msg: 'File size exceeds 5MB limit' })
    }

    const ext = MIME_TO_EXT[mimeType] || ''
    const fileId = `${randomUUID()}${ext}`
    const filePath = path.join(uploadsDir, fileId)
    fs.writeFileSync(filePath, buffer)

    res.json({
      code: 0,
      msg: 'File uploaded successfully',
      data: {
        fileId,
        fileName,
        mimeType,
        size: buffer.length,
      },
    })
  }
  catch (error: any) {
    console.error('Error uploading file:', error)
    res.json({ code: 1, msg: 'Failed to upload file', error: error.message })
  }
})

// 提供附件文件访问
router.get('/files/:fileId', (req: Request, res: Response) => {
  try {
    const { fileId } = req.params
    // 安全校验：只允许字母数字、连字符、点
    if (!/^[\w\-.]+$/.test(fileId)) {
      return res.status(400).json({ code: 1, msg: 'Invalid file ID' })
    }

    const filePath = path.join(uploadsDir, fileId)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ code: 1, msg: 'File not found' })
    }

    const ext = path.extname(fileId).toLowerCase()
    const mimeType = EXT_TO_MIME[ext] || 'application/octet-stream'
    res.setHeader('Content-Type', mimeType)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.sendFile(filePath)
  }
  catch (error: any) {
    console.error('Error serving file:', error)
    res.status(500).json({ code: 1, msg: 'Failed to serve file', error: error.message })
  }
})

// 创建新对话
router.post('/conversations', async (req: Request, res: Response) => {
  try {
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const finalThreadId = `thread_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    const conversation = ChatContextAPI.createConversation({
      id: conversationId,
      title: 'New Chat',
      thread_id: finalThreadId,
      // model: model || 'gpt-4',
    })

    res.json({
      code: 0,
      msg: 'Conversation created successfully',
      data: conversation,
    })
  }
  catch (error: any) {
    console.error('Error creating conversation:', error)
    res.json({
      code: 1,
      msg: 'Failed to create conversation',
      error: error.message,
    })
  }
})

// 获取对话列表
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const conversations = ChatContextAPI.getConversations()

    res.json({
      code: 0,
      msg: 'Conversations fetched successfully',
      data: conversations,
    })
  }
  catch (error: any) {
    console.error('Error getting conversations:', error)
    res.json({
      code: 1,
      error: error.message,
      msg: 'Failed to get conversations',
    })
  }
})

// 获取对话详情
router.get('/conversations/:conversationId', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params

    if (!conversationId || typeof conversationId !== 'string') {
      return res.json({
        code: 1,
        error: 'Conversation ID is required',
        msg: 'Conversation ID is required',
      })
    }

    const conversationDetail = ChatContextAPI.getConversation(conversationId)

    const messages = ChatContextAPI.getMessagesByConversation(conversationId)

    res.json({
      code: 0,
      msg: 'Conversation detail fetched successfully',
      data: {
        ...conversationDetail,
        messages,
      },
    })
  }
  catch (error: any) {
    console.error('Error getting conversation detail:', error)
    res.json({
      code: 1,
      error: error.message,
      msg: 'Failed to get conversation detail',
    })
  }
})

// 更新对话信息
router.put('/conversations/:conversationId', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params
    const { title, model } = req.body

    const success = ChatContextAPI.updateConversation(conversationId as string, { title, model })

    if (!success) {
      return res.json({
        code: 1,
        error: 'Conversation not found',
        msg: 'Conversation not found',
      })
    }

    res.json({
      code: 0,
      msg: 'Conversation updated successfully',
    })
  }
  catch (error: any) {
    console.error('Error updating conversation:', error)
    res.json({
      code: 1,
      error: error.message,
      msg: 'Failed to update conversation',
    })
  }
})

// 删除对话
router.delete('/conversations/:conversationId', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params as { conversationId: string }

    // 获取对话信息，找到对应的thread_id
    const conversation = ChatContextAPI.getConversation(conversationId)
    if (!conversation) {
      return res.json({
        code: 1,
        error: 'Conversation not found',
        msg: 'Conversation not found',
      })
    }

    // 删除对话相关的消息
    ChatContextAPI.deleteMessagesByConversation(conversationId)

    // 删除对话记录
    ChatContextAPI.deleteConversation(conversationId)

    // 删除 LangGraph SQLite checkpoint 中该 thread 的数据
    deleteCheckpoint(conversationId)

    res.json({
      code: 0,
      msg: 'Conversation deleted successfully',
    })
  }
  catch (error: any) {
    console.error('Error deleting conversation:', error)
    res.json({
      code: 1,
      msg: 'Failed to delete conversation',
      error: error.message,
    })
  }
})

// 读取文件内容
router.get('/conversations/readFileContent', async (req: Request, res: Response) => {
  try {
    const { filePath } = req.query
    if (!filePath) {
      return res.json({
        code: 1,
        error: 'FilePath is required',
        msg: 'FilePath is required',
      })
    }
    const content = await fsPromises.readFile(filePath as string, 'utf-8')
    res.json({
      code: 0,
      msg: 'File content fetched successfully',
      data: content,
    })
  }
  catch (error: any) {
    console.error('Error getting messages:', error)
    res.json({
      code: 1,
      error: error.message,
      msg: 'Failed to get messages',
    })
  }
})

// 附件类型定义
interface AttachmentRef {
  fileId: string
  fileName: string
  mimeType: string
  size?: number
}

/**
 * 构建 LangChain HumanMessage 的多模态内容数组
 */
function buildMessageContent(message: string, attachments: AttachmentRef[]): any[] | string {
  const parts: any[] = []
  const attachmentInfos: string[] = []

  if (message?.trim()) {
    parts.push({ type: 'text', text: message })
  }

  for (const att of attachments) {
    const filePath = path.join(uploadsDir, att.fileId)
    if (!fs.existsSync(filePath)) {
      console.warn(`Attachment file not found: ${att.fileId}`)
      continue
    }

    attachmentInfos.push(`- 文件名: ${att.fileName}, 本地路径: ${filePath}, 类型: ${att.mimeType}`)

    if (att.mimeType.startsWith('image/')) {
      const base64 = fs.readFileSync(filePath).toString('base64')
      parts.push({
        type: 'image_url',
        image_url: { url: `data:${att.mimeType};base64,${base64}` },
      })
    }
    else if (att.mimeType === 'text/plain') {
      const text = fs.readFileSync(filePath, 'utf-8')
      parts.push({ type: 'text', text: `[文件: ${att.fileName}]\n${text}` })
    }
    else if (att.mimeType === 'application/pdf') {
      const base64 = fs.readFileSync(filePath).toString('base64')
      // 使用 OpenAI 兼容格式，Claude 会自动处理
      parts.push({
        type: 'image_url',
        image_url: { url: `data:application/pdf;base64,${base64}` },
      })
    }
  }

  if (attachmentInfos.length > 0) {
    parts.push({
      type: 'text',
      text: `\n[附件信息 - 可用于文件操作的本地路径]\n${attachmentInfos.join('\n')}`,
    })
  }

  if (parts.length === 0)
    return ''
  if (parts.length === 1 && parts[0].type === 'text')
    return parts[0].text
  return parts
}

/**
 * 纯文本 HumanMessage：`text/plain` 内联全文，其余类型只写本地路径与元数据（兼容不支持多模态的模型）。
 * 需要 base64 图片/PDF 等多模态时请用 `buildMessageContent`，并在请求中传 `multimodalAttachments: true`。
 */
function buildMessageContentAsPlainText(message: string, attachments: AttachmentRef[]): string {
  const chunks: string[] = []

  if (message?.trim()) {
    chunks.push(message.trim())
  }

  for (const att of attachments) {
    const filePath = path.join(uploadsDir, att.fileId)
    if (!fs.existsSync(filePath)) {
      console.warn(`Attachment file not found: ${att.fileId}`)
      continue
    }

    if (att.mimeType === 'text/plain') {
      const text = fs.readFileSync(filePath, 'utf-8')
      chunks.push(`[文件: ${att.fileName}]\n${text}`)
    }
    else {
      chunks.push(
        `[附件] 文件名: ${att.fileName}, 本地路径: ${filePath}, 类型: ${att.mimeType}`,
      )
    }
  }

  return chunks.join('\n\n')
}

// 标题输出的 Zod Schema
const TitleOutputSchema = z.object({
  title: z.string().max(20, '标题不能超过20个字符').describe('对话标题，简洁准确概括主题，不超过10个汉字或20个字符'),
})

/**
 * 使用 LLM 生成对话标题（使用 withStructuredOutput 确保可控）
 */
async function generateConversationTitle(
  userMessage: string,
  attachments: AttachmentRef[],
  streamCallback: (event: string) => void,
): Promise<string> {
  const llm = await createLLM(false)
  const messageContent = buildMessageContentAsPlainText(userMessage, attachments)

  // 使用 withStructuredOutput 确保返回结构化数据
  const structuredLlm = llm.withStructuredOutput(TitleOutputSchema, {
    name: 'generate_title',
  })

  const result = await structuredLlm.invoke([
    new SystemMessage('你是一个专业的对话标题生成助手。'),
    new HumanMessage(`请根据用户的第一条消息，为这个对话生成一个简洁、准确的标题。

用户消息：
${messageContent}`),
  ])

  const title = result.title.trim()

  // 发送 SSE 事件更新前端
  streamCallback(streamAdapter.title(title))

  return title
}

// 开始对话（流式聊天）
router.post('/chat', async (req: Request, res: Response) => {
  const {
    message,
    conversationId,
    enableThinking: _enableThinking,
    mode,
    attachments,
    multimodalAttachments,
  } = req.body
  const attachmentList: AttachmentRef[] = Array.isArray(attachments) ? attachments : []

  // 敏感词校验：使用全局挂载的 __SENSITIVE_WORDS__（build-words 注入）
  const sensitiveWords = (globalThis as any).__SENSITIVE_WORDS__ as string[] | undefined
  if (Array.isArray(sensitiveWords) && sensitiveWords.length > 0) {
    const text = String(message)
    const matched = sensitiveWords.filter(
      (w: string) => typeof w === 'string' && w.length > 0 && text.includes(w),
    )
    if (matched.length > 0) {
      res.write(streamAdapter.error(`The content contains sensitive words, please modify and try again: ${matched.join(', ')}`))
      res.end()
      return
    }
  }

  const abortController = createAbort(conversationId)

  if ((!message && !attachmentList.length) || !conversationId) {
    return res.json({
      code: 1,
      error: 'message or attachments and conversationId are required',
      msg: 'message or attachments and conversationId are required',
    })
  }

  // 获取对话信息
  const conversation = ChatContextAPI.getConversation(conversationId)
  if (!conversation) {
    return res.json({
      code: 1,
      error: 'conversation not found',
      msg: 'conversation not found',
    })
  }

  // 自动设置为活跃对话
  ChatContextAPI.setActiveConversation(conversationId)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  res.flushHeaders()

  // 添加用户消息到对话历史
  const agentMode = (mode === 'orchestrator' ? 'orchestrator' : 'simple') as 'orchestrator' | 'simple'
  ChatContextAPI.addMessage({
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
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

  const fileName = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  const sseFilePath = path.join(env.CHECKPOINT_DIR!, 'sse', `${fileName}.sse`)

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

  const streamCallback = (event: any) => {
    res.write(event)
    sseLogger.log(event)

    if (typeof (res as any).flush === 'function') {
      (res as any).flush()
    }
  }

  // 先把会话开始标识写入
  streamCallback(streamAdapter.session(conversation.thread_id))

  // 如果标题还没有设置，就异步生成标题（不阻塞主流程）
  if (conversation.is_title_set === 0 || conversation.is_title_set === undefined) {
    generateConversationTitle(message || '', attachmentList, streamCallback)
      .then((generatedTitle) => {
        if (generatedTitle) {
          ChatContextAPI.updateConversation(conversationId, { title: generatedTitle })
        }
      })
      .catch((err) => {
        console.error('Failed to generate title:', err)
      })
  }

  // 创建 token 使用量统计器，用于统计本次请求的 token 消耗
  // const tokenUsageAggregator = new RequestTokenUsageAggregator(conversation.thread_id)

  const startTime = Date.now()
  try {
    const config = {
      configurable: {
        thread_id: conversation.thread_id,
      },
      streamMode: ['messages', 'custom', 'tools'],
      signal: abortController.signal,
      // callbacks: [new TokenUsageChange(conversation.thread_id)],
      // 供 parallel_dispatch 工具内将 worker 的 stream 写出到客户端，避免只依赖外层 stream 合并
      writer: streamCallback,
    }

    const useMultimodalAttachments = multimodalAttachments === true
    const messageContent = useMultimodalAttachments
      ? buildMessageContent(message, attachmentList)
      : buildMessageContentAsPlainText(message, attachmentList)
    const input = {
      messages: [
        Array.isArray(messageContent)
          ? new HumanMessage({ content: messageContent })
          : new HumanMessage(messageContent || message || ''),
      ],
      streamCallback,
    }

    await mcpManager.createPlaywrightClientForWorker('simple')
    const simpleTools = await mcpManager.getToolsForWorker('simple')
    const agent = await createAgent({
      mode: agentMode,
      tools: simpleTools,
      name: agentMode,
      conversationId,
    })
    const state = new StreamState()
    const stream = await agent.stream(input, config)
    // let worker_start = false
    for await (const rawChunk of stream) {
      const [namespace, chunk] = rawChunk
      // Worker 期间跳过非 custom，但必须保留主 agent 的 parallel_dispatch 的 tools 事件，否则 tool start 会丢失、agent 认为返回空
      const isParallelDispatchTool = namespace === 'tools' && (chunk?.name === 'parallel_dispatch')
      if (isWorkerStart() && namespace !== 'custom' && !isParallelDispatchTool) {
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

    // 最后一个消息的特殊处理（针对 deepseek 模型）
    // const lastMessageIsThinking = state.theLastMessageIsThinking()
    // if (lastMessageIsThinking) {
    //   streamCallback(streamAdapter.content(lastMessageIsThinking, `content:${state.getRandomId()}`))
    // }

    streamCallback(streamAdapter.done())
  }
  catch (error: any) {
    // 检查是否是中断错误（用户取消或客户端断开连接）
    if (AbortError.isAbortError(error) || error.message.includes('User cancelled')) {
      // 中断错误，静默处理，不发送错误消息给客户端
      console.log('Chat interrupted by user')
      streamCallback(streamAdapter.interrupt(error.message))
    }
    else {
      // 其他错误，正常处理
      console.error('Error in chat:', error)
      const errorCode = extractHttpErrorCode(error.message)
      streamCallback(streamAdapter.error(error.message, errorCode))
    }
  }
  finally {
    await mcpManager.destroyPlaywrightClientForWorker('simple')

    // 获取本次请求的 token 使用量统计
    // const tokenUsage = tokenUsageAggregator.getUsage()

    const endTime = Date.now()
    const duration = endTime - startTime

    // 发送消息保存事件
    ;(process as any).parentPort?.postMessage({
      event: 'save_chat_message',
      data: {
        conversationId,
        file: sseFilePath,
        message,
        inputToken: 0,
        outputToken: 0,
        time: duration,
        taskType: agentMode,
      },
    })

    // 清理统计器资源
    // tokenUsageAggregator.dispose()
    sseLoggerManager.closeLogger(sseFilePath)
  }

  res.end()
})

// 中断对话
router.post('/chat/:conversationId/interrupt', async (req: Request, res: Response) => {
  try {
    const conversationId = Array.isArray(req.params.conversationId)
      ? req.params.conversationId[0]
      : req.params.conversationId
    if (abortRun(conversationId)) {
      return res.json({
        code: 0,
        msg: 'Conversation interrupted successfully',
      })
    }
    else {
      return res.json({
        code: 1,
        error: 'Conversation not found',
        msg: 'Conversation not found',
      })
    }
  }
  catch (error: any) {
    console.error('Error interrupting conversation:', error)
    res.json({
      code: 1,
      error: error.message,
      msg: 'Failed to interrupt conversation',
    })
  }
})

/** 从上游错误消息中提取 HTTP 状态码，如 "402 \"Insufficient balance\"" → 402 */
function extractHttpErrorCode(message: string): number | undefined {
  const match = message?.match(/\b([45]\d{2})\b/)
  return match ? Number(match[1]) : undefined
}

export default router
