import type { Request, Response } from 'express'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { Command } from '@langchain/langgraph'
import { Router } from 'express'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { abortRun, cleanupRun, createAbort } from '../abortRegistry'
import { env } from '../config'
import { ChatContextAPI } from '../database/conversations'
import { createChatAgent, createImageAgent, createScriptAgent, deleteCheckpoint } from '../deepagents'
import { handleStream, handleStreamEvents, StreamState } from '../deepagents/handle-stream'
import { clearImageSpec, consumeImageSpec } from '../deepagents/imageSpec'
import { fileManager } from '../fileManager'
import { cancelInterrupt, createInterruptGate, resolveInterrupt } from '../interruptRegistry'
import { createLLM } from '../llm'
import { isAbortLike, normalizeAgentError } from './agentError'
import { generateImagesFromPlan } from './imageGeneration'
import { sseLoggerManager } from './sseLogger'
import { streamAdapter } from './streamAdapter'

let _dirsInitialized = false
/**
 * 初始化路由所需目录（sse、uploads），幂等，由 server/index.ts 的 createApp() 调用。
 * uploads 目录由 FileManager 统一管理。
 */
export function initChatRouteDirs() {
  if (_dirsInitialized)
    return
  if (!fs.existsSync(path.join(env.CHECKPOINT_DIR, 'sse')))
    fs.mkdirSync(path.join(env.CHECKPOINT_DIR, 'sse'), { recursive: true })
  fileManager.ensureDir()
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

function normalizeMimeType(mimeType: string) {
  return mimeType.split(';')[0].trim().toLowerCase()
}

function extractBase64Payload(data: string) {
  const trimmed = data.trim()
  const match = trimmed.match(/^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/s)

  if (!match) {
    return {
      base64: trimmed,
      mimeType: undefined as string | undefined,
    }
  }

  return {
    base64: match[2],
    mimeType: normalizeMimeType(match[1]),
  }
}

/**
 * 5MB
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024
const router: Router = Router()

// 上传附件文件
router.post('/upload', async (req: Request, res: Response) => {
  try {
    const { data, mimeType, fileName } = req.body

    if (!data || !mimeType || !fileName) {
      return res.json({ code: 1, msg: 'data, mimeType and fileName are required' })
    }

    const normalizedMimeType = normalizeMimeType(mimeType)
    const { base64, mimeType: detectedMimeType } = extractBase64Payload(data)
    const finalMimeType = detectedMimeType || normalizedMimeType

    if (!ALLOWED_MIME_TYPES.has(finalMimeType)) {
      return res.json({ code: 1, msg: `Unsupported file type: ${finalMimeType}` })
    }

    const buffer = Buffer.from(base64, 'base64')
    if (buffer.length > MAX_FILE_SIZE) {
      return res.json({ code: 1, msg: 'File size exceeds 5MB limit' })
    }

    // 统一交给 FileManager：写本地 + sha256 去重 + 同步上传 OSS + 元信息入库
    const record = await fileManager.saveBuffer({
      buffer,
      fileName,
      mimeType: finalMimeType,
      source: 'upload',
      uploadNow: true,
    })
    const localUrl = `/api/files/${record.file_id}`

    res.json({
      code: 0,
      msg: 'File uploaded successfully',
      data: {
        fileId: record.file_id,
        fileName,
        mimeType: record.mime_type || finalMimeType,
        size: record.size ?? buffer.length,
        url: localUrl,
        localUrl,
        ...(record.oss_url ? { remoteUrl: record.oss_url, fileUrl: record.oss_url } : {}),
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
    const fileId = Array.isArray(req.params.fileId)
      ? req.params.fileId[0]
      : req.params.fileId
    if (!fileId) {
      return res.status(400).json({ code: 1, msg: 'File ID is required' })
    }
    // 安全校验：只允许字母数字、连字符、点
    if (!/^[\w\-.]+$/.test(fileId)) {
      return res.status(400).json({ code: 1, msg: 'Invalid file ID' })
    }

    const filePath = fileManager.getLocalPath(fileId)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ code: 1, msg: 'File not found' })
    }

    const mimeType = fileManager.resolveMimeType(fileId)
    // 去重条目的物理文件名可能与 fileId 不同，按真实 local_path 发送
    return res.sendFile(path.basename(filePath), {
      root: path.dirname(filePath),
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    }, (error) => {
      if (!error)
        return

      console.error('Error sending file:', error)
      if (!res.headersSent) {
        const sendError = error as Error & { statusCode?: number }
        res.status(sendError.statusCode || 500).json({
          code: 1,
          msg: 'Failed to serve file',
          error: sendError.message,
        })
      }
    })
  }
  catch (error: any) {
    console.error('Error serving file:', error)
    return res.status(500).json({ code: 1, msg: 'Failed to serve file', error: error.message })
  }
})

// 创建新对话
router.post('/conversations', async (req: Request, res: Response) => {
  try {
    const conversationType = req.body?.conversationType === 'asset' ? 'asset' : 'automation'
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const finalThreadId = `thread_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    const conversation = ChatContextAPI.createConversation({
      id: conversationId,
      title: 'New Chat',
      thread_id: finalThreadId,
      conversation_type: conversationType,
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
    const { title, model, conversationType } = req.body

    const success = ChatContextAPI.updateConversation(conversationId as string, {
      title,
      model,
      conversation_type: conversationType,
    })

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
  url?: string
  localUrl?: string
  remoteUrl?: string
  fileUrl?: string
}

function getAttachmentFilePath(fileId: string) {
  return fileManager.getLocalPath(fileId)
}

function asRemoteFileUrl(url?: string) {
  return url && /^https?:\/\//i.test(url) ? url : undefined
}

async function resolveAttachmentRemoteUrl(att: AttachmentRef, options: { required?: boolean } = {}) {
  // 前端回传的远程 URL 可信，优先复用；否则交给 FileManager（按 hash 去重 / 上传 / 回填）
  const direct = asRemoteFileUrl(att.remoteUrl) || asRemoteFileUrl(att.fileUrl)
  if (direct)
    return direct
  const remoteUrl = await fileManager.resolveRemoteUrl(att.fileId)
  if (!remoteUrl && options.required)
    throw new Error(`Failed to upload attachment to file server: ${att.fileName || att.fileId}`)
  return remoteUrl
}

async function hydrateAttachmentFileUrls(attachments: Array<Partial<AttachmentRef> & { fileId: string }>) {
  return Promise.all(attachments.map(async (input) => {
    // 前端仅回传 fileId，其余信息（fileName/mimeType/size/本地与远程 URL）由 FileManager 从 files 表补全
    const att = fileManager.toAttachmentRef(input.fileId, input)
    const remoteUrl = await resolveAttachmentRemoteUrl(att)
    return {
      ...att,
      ...(remoteUrl ? { remoteUrl, fileUrl: remoteUrl } : {}),
    }
  }))
}

function readAttachmentAsDataUrl(att: AttachmentRef) {
  return fileManager.readDataUrl(att.fileId, att.mimeType)
}

/**
 * 构建 LangChain HumanMessage 的多模态内容数组
 */
async function buildMessageContent(
  message: string,
  attachments: AttachmentRef[],
  options: { requireRemoteImageUrl?: boolean } = {},
): Promise<any[] | string> {
  const parts: any[] = []
  const attachmentInfos: string[] = []
  const isZh = env.SYSTEM_LANGUAGE === 'zh-CN'

  if (message?.trim()) {
    parts.push({ type: 'text', text: message })
  }

  for (const att of attachments) {
    const filePath = getAttachmentFilePath(att.fileId)
    const remoteUrl = att.remoteUrl || att.fileUrl
    const hasLocalFile = att.fileId ? fileManager.exists(att.fileId) : false
    if (!hasLocalFile && !remoteUrl) {
      console.warn(`Attachment file not found: ${att.fileId}`)
      continue
    }

    attachmentInfos.push(isZh
      ? `- 文件名: ${att.fileName}, 本地路径: ${hasLocalFile ? filePath : 'N/A'}, 文件URL: ${remoteUrl || '未上传'}, 类型: ${att.mimeType}`
      : `- filename: ${att.fileName}, local path: ${hasLocalFile ? filePath : 'N/A'}, file URL: ${remoteUrl || 'not uploaded'}, type: ${att.mimeType}`)

    if (att.mimeType.startsWith('image/')) {
      let imageUrl = remoteUrl
      if (!imageUrl && options.requireRemoteImageUrl)
        imageUrl = await resolveAttachmentRemoteUrl(att, { required: true })

      parts.push({
        type: 'image_url',
        image_url: { url: imageUrl || readAttachmentAsDataUrl(att) },
      })
    }
    else if (att.mimeType === 'text/plain') {
      if (!hasLocalFile)
        continue

      const text = fileManager.readBuffer(att.fileId).toString('utf-8')
      parts.push({ type: 'text', text: isZh ? `[文件: ${att.fileName}]\n${text}` : `[file: ${att.fileName}]\n${text}` })
    }
    else if (att.mimeType === 'application/pdf') {
      if (!hasLocalFile)
        continue

      parts.push({
        type: 'image_url',
        image_url: { url: readAttachmentAsDataUrl(att) },
      })
    }
  }

  if (attachmentInfos.length > 0) {
    parts.push({
      type: 'text',
      text: isZh
        ? `\n[附件信息 - 可用于文件操作的本地路径]\n${attachmentInfos.join('\n')}`
        : `\n[Attachment info - local paths for file operations]\n${attachmentInfos.join('\n')}`,
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
  const isZh = env.SYSTEM_LANGUAGE === 'zh-CN'

  if (message?.trim()) {
    chunks.push(message.trim())
  }

  for (const att of attachments) {
    const filePath = getAttachmentFilePath(att.fileId)
    if (!att.fileId || !fileManager.exists(att.fileId)) {
      console.warn(`Attachment file not found: ${att.fileId}`)
      continue
    }

    if (att.mimeType === 'text/plain') {
      const text = fileManager.readBuffer(att.fileId).toString('utf-8')
      chunks.push(isZh ? `[文件: ${att.fileName}]\n${text}` : `[file: ${att.fileName}]\n${text}`)
    }
    else {
      chunks.push(isZh
        ? `[附件] 文件名: ${att.fileName}, 本地路径: ${filePath}, 类型: ${att.mimeType}`
        : `[attachment] filename: ${att.fileName}, local path: ${filePath}, type: ${att.mimeType}`,
      )
    }
  }

  return chunks.join('\n\n')
}

const TitleOutputSchema = z.object({
  title: z.string().max(20, 'Title must not exceed 20 characters').describe('Conversation title, concise and accurate, no more than 20 characters'),
})

async function generateConversationTitle(
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

/**
 * 构造给 image agent 的真实用户输入文本：
 * - 用「用户输入如下：」+ Markdown 代码块包裹原始输入，把用户文字与系统框架彻底隔离，
 *   让模型按字面解读（顺带抵御提示注入），不再把生图参数/兜底指令混进提示词。
 * - 生图参数（比例/清晰度/张数）一律以前端 assetOptions 为准，不进提示词、不进 save_image_spec。
 * - 空输入（仅附件、无文字）也放进代码块，不再自动生图，交由 image agent 的「无效输入护栏」澄清。
 * 附件信息仍由 buildMessageContent 在其后追加，保持不变。
 */
function buildImageAgentUserMessage(message: string) {
  const isZh = env.SYSTEM_LANGUAGE === 'zh-CN'
  const trimmed = message.trim()
  const preface = isZh ? '用户输入如下：' : 'User input is as follows:'
  const inputText = trimmed || (isZh ? '（用户未输入任何文字。）' : '(The user did not enter any text.)')

  // 用比输入中最长反引号串更长的围栏，避免用户输入里自带的 ``` 破坏代码块
  const longestBacktickRun = (inputText.match(/`+/g) ?? [])
    .reduce((max, run) => Math.max(max, run.length), 0)
  const fence = '`'.repeat(Math.max(3, longestBacktickRun + 1))

  return `${preface}\n${fence}\n${inputText}\n${fence}`
}

function resolveChatAgentMode(mode: unknown): 'simple' | 'orchestrator' {
  return mode === 'orchestrator' ? 'orchestrator' : 'simple'
}

function streamImageAgentEvents(rawChunk: any, state: StreamState, streamCallback: (event: string) => void) {
  const result = handleStreamEvents(rawChunk, state)
  const events = Array.isArray(result) ? result : result ? [result] : []
  for (const event of events) {
    if (
      (event.type === 'tool_call' || event.type === 'tool_result')
      && event.data?.toolName === 'save_image_spec'
    ) {
      continue
    }

    streamCallback(streamAdapter.formatSSE(event))
  }
}

router.post('/images/generations', async (req: Request, res: Response) => {
  const {
    message,
    conversationId,
    attachments,
    assetOptions,
  } = req.body
  const attachmentList: AttachmentRef[] = await hydrateAttachmentFileUrls(Array.isArray(attachments) ? attachments : [])
  const prompt = typeof message === 'string' ? message : ''

  if ((!prompt.trim() && attachmentList.length === 0) || !conversationId) {
    return res.json({
      code: 1,
      error: 'message or attachments and conversationId are required',
      msg: 'message or attachments and conversationId are required',
    })
  }

  const conversation = ChatContextAPI.getConversation(conversationId)
  if (!conversation) {
    return res.json({
      code: 1,
      error: 'conversation not found',
      msg: 'conversation not found',
    })
  }

  const abortController = createAbort(conversationId)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const fileName = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  const sseFilePath = path.join(env.CHECKPOINT_DIR!, 'sse', `${fileName}.sse`)

  const sseLogger = sseLoggerManager.createLogger(sseFilePath)
  clearImageSpec(conversationId, fileName)

  const streamCallback = (event: string) => {
    res.write(event)
    sseLogger.log(event)
    if (typeof (res as any).flush === 'function') {
      (res as any).flush()
    }
  }

  // const startTime = Date.now()
  let destroy: (() => Promise<void>) | undefined

  try {
    ChatContextAPI.setActiveConversation(conversationId)

    const userMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    ChatContextAPI.addMessage({
      id: userMessageId,
      conversation_id: conversationId,
      role: 'user',
      content: prompt,
      content_type: 'text',
      storage_type: 'inline',
      agent_mode: 'image',
      metadata: {
        timestamp: Date.now(),
        source: 'api_image_generation',
        attachments: attachmentList.length > 0 ? attachmentList : undefined,
        assetOptions,
      },
    })

    // 预先注册 assistant 消息，指向 SSE 文件（和 /chat 一致）
    ChatContextAPI.addMessage({
      id: fileName,
      conversation_id: conversationId,
      role: 'assistant',
      content: '',
      content_type: 'file',
      storage_type: 'file',
      file_path: sseFilePath,
      agent_mode: 'image',
      metadata: {
        timestamp: Date.now(),
        source: 'sse_stream',
        assetOptions,
      },
    })

    if (conversation.is_title_set === 0 || conversation.is_title_set === undefined) {
      await generateConversationTitle(prompt, attachmentList, conversationId, userMessageId, streamCallback)
        .then((generatedTitle) => {
          if (generatedTitle) {
            ChatContextAPI.updateConversation(conversationId, { title: generatedTitle })
          }
        })
        .catch((err) => {
          console.error('Failed to generate title:', err)
        })
    }

    const imageAgent = await createImageAgent({ conversationId, turnId: userMessageId })
    const agent = imageAgent.agent
    destroy = imageAgent.destroy

    const config: any = {
      configurable: {
        thread_id: conversation.thread_id,
        imageContext: {
          conversationId,
          messageId: fileName,
          userMessageId,
          attachments: attachmentList,
          assetOptions,
        },
      },
      conversationId,
      turnId: userMessageId,
      streamMode: ['messages', 'custom', 'tools', 'updates'],
      signal: abortController.signal,
      writer: streamCallback,
      imageContext: {
        conversationId,
        messageId: fileName,
        userMessageId,
        attachments: attachmentList,
        assetOptions,
      },
    }
    const imageRequest = buildImageAgentUserMessage(prompt)
    const messageContent = await buildMessageContent(imageRequest, attachmentList, { requireRemoteImageUrl: true })
    const input = {
      messages: [
        Array.isArray(messageContent)
          ? new HumanMessage({ content: messageContent })
          : new HumanMessage(messageContent || imageRequest),
      ],
      streamCallback,
    }
    const checkpointer = (agent as any).checkpointer
    let invokeInput: any = input

    if (checkpointer) {
      const checkpointState = await (agent as any).getState(config)
      if (checkpointState.next && checkpointState.next.length > 0)
        invokeInput = null
    }

    const runImageAgentTurn = async (turnInput: any, turnConfig = config) => {
      const turnState = new StreamState()
      let currentInput = turnInput

      while (true) {
        const stream = await (agent as any).stream(currentInput, turnConfig)
        let interrupted = false
        let interruptValue: any = null

        for await (const rawChunk of stream) {
          const [, chunk] = rawChunk

          if (chunk?.__interrupt__) {
            interrupted = true
            interruptValue = chunk.__interrupt__
            continue
          }

          streamImageAgentEvents(rawChunk, turnState, streamCallback)
        }

        if (!interrupted)
          break

        const interrupts = interruptValue[0]?.value ?? interruptValue
        const actionRequests = interrupts?.actionRequests ?? []
        const reviewConfigs = interrupts?.reviewConfigs ?? []
        const interruptsId = randomUUID()
        streamCallback(streamAdapter.hitlInterrupt({ actionRequests, reviewConfigs, interruptsId }))
        const decision = await createInterruptGate(conversationId)
        streamCallback(streamAdapter.hitlResume({ interruptsId, decisions: decision.decisions }))
        currentInput = new Command({ resume: { decisions: decision.decisions } })
      }

      return turnState
    }

    await runImageAgentTurn(invokeInput)
    const generationPlan = consumeImageSpec(conversationId, fileName)
    if (generationPlan) {
      await generateImagesFromPlan(generationPlan, {
        conversationId,
        messageId: fileName,
        attachments: attachmentList,
        assetOptions,
        writer: streamCallback,
        signal: abortController.signal,
      }, imageAgent.imageProviderOptions)
    }
    else {
      console.log('Image agent did not save an image generation spec; skipping image generation for conversation', conversationId, 'message', fileName)
    }

    streamCallback(streamAdapter.done())
  }
  catch (error: any) {
    // 清理可能挂起的 interrupt gate
    cancelInterrupt(conversationId)
    if (isAbortLike(error)) {
      console.log('Image generation interrupted by user')
    }
    else {
      console.error('Error generating image:', error)
      streamCallback(streamAdapter.error(normalizeAgentError(error)))
    }
    streamCallback(streamAdapter.done())
  }
  finally {
    await destroy?.()
    cleanupRun(conversationId)
    sseLoggerManager.closeLogger(sseFilePath)
  }

  res.end()
})

// 开始对话（流式聊天）
router.post('/chat', async (req: Request, res: Response) => {
  const {
    message,
    conversationId,
    enableThinking: _enableThinking,
    mode,
    attachments,
    multimodalAttachments,
    script,
  } = req.body
  const attachmentList: AttachmentRef[] = await hydrateAttachmentFileUrls(Array.isArray(attachments) ? attachments : [])

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
  const agentMode = resolveChatAgentMode(mode)
  const useMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  ChatContextAPI.addMessage({
    id: useMessageId,
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
  let orchestratorStoppedSent = false

  const streamCallback = (event: any) => {
    res.write(event)
    sseLogger.log(event)

    try {
      const matched = typeof event === 'string' ? event.match(/^data: (.*)$/m) : null
      const parsed = matched?.[1] ? JSON.parse(matched[1]) : null
      if (parsed?.type === 'orchestrator_stopped') {
        orchestratorStoppedSent = true
      }
    }
    catch {
      // Ignore malformed diagnostic data; the SSE event was already written.
    }

    if (typeof (res as any).flush === 'function') {
      (res as any).flush()
    }
  }

  // 先把会话开始标识写入
  streamCallback(streamAdapter.session(conversation.thread_id))

  // 如果标题还没有设置，就生成标题
  if (conversation.is_title_set === 0 || conversation.is_title_set === undefined) {
    await generateConversationTitle(message || '', attachmentList, conversationId, useMessageId, streamCallback)
      .then((generatedTitle) => {
        if (generatedTitle) {
          ChatContextAPI.updateConversation(conversationId, { title: generatedTitle })
        }
      })
      .catch((err) => {
        console.error('Failed to generate title:', err)
      })
  }

  // const startTime = Date.now()
  const { agent, destroy } = await (script ? createScriptAgent : createChatAgent)({
    mode: agentMode,
    conversationId,
    turnId: useMessageId,
  })

  try {
    const config: any = {
      configurable: {
        thread_id: conversation.thread_id,
      },
      conversationId,
      turnId: useMessageId,
      streamMode: ['messages', 'custom', 'tools', 'updates'],
      signal: abortController.signal,
      // callbacks: [new TokenUsageChange(conversation.thread_id)],
      // 供 parallel_dispatch 工具内将 worker 的 stream 写出到客户端，避免只依赖外层 stream 合并
      writer: streamCallback,
    }

    const useMultimodalAttachments = multimodalAttachments === true
    const messageContent = useMultimodalAttachments
      ? await buildMessageContent(message, attachmentList)
      : buildMessageContentAsPlainText(message, attachmentList)
    const input = {
      messages: [
        Array.isArray(messageContent)
          ? new HumanMessage({ content: messageContent })
          : new HumanMessage(messageContent || message || ''),
      ],
      streamCallback,
    }

    const state = new StreamState()

    // 检查是否有 pending interrupt（用户可能关闭软件后重新打开）
    // 如果有，必须先处理 interrupt，不能接受新消息
    const checkpointer = (agent as any).checkpointer
    let invokeInput: any = input

    if (checkpointer) {
      const checkpointState = await (agent as any).getState(config)
      if (checkpointState.next && checkpointState.next.length > 0) {
        // 有 pending interrupt，使用 null 输入触发 interrupt
        invokeInput = null
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

    streamCallback(streamAdapter.done())
  }
  catch (error: any) {
    // 清理可能挂起的 interrupt gate
    cancelInterrupt(conversationId)

    // 检查是否是中断错误（用户取消或客户端断开连接）
    if (isAbortLike(error)) {
      // 中断错误，静默处理，不发送错误消息给客户端
      console.log('Chat interrupted by user')
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

    // const endTime = Date.now()
    // const duration = endTime - startTime

    // 发送消息保存事件
    // ;(process as any).parentPort?.postMessage({
    //   event: 'save_chat_message',
    //   data: {
    //     conversationId,
    //     file: sseFilePath,
    //     message,
    //     inputToken: 0,
    //     outputToken: 0,
    //     time: duration,
    //     taskType: agentMode,
    //   },
    // })

    // 清理统计器资源
    sseLoggerManager.closeLogger(sseFilePath)
  }

  res.end()
})

// 恢复被 HITL interrupt 暂停的对话
router.post('/conversations/:conversationId/resume', async (req: Request, res: Response) => {
  try {
    const conversationId = Array.isArray(req.params.conversationId)
      ? req.params.conversationId[0]
      : req.params.conversationId
    const { decisions } = req.body

    if (!decisions || !Array.isArray(decisions)) {
      return res.json({
        code: 1,
        error: 'decisions array is required',
        msg: 'decisions array is required',
      })
    }

    if (resolveInterrupt(conversationId, { decisions })) {
      return res.json({
        code: 0,
        msg: 'Resume decision submitted successfully',
      })
    }
    else {
      return res.json({
        code: 1,
        error: 'No pending interrupt found for this conversation',
        msg: 'No pending interrupt found for this conversation',
      })
    }
  }
  catch (error: any) {
    console.error('Error resuming conversation:', error)
    res.json({
      code: 1,
      error: error.message,
      msg: 'Failed to resume conversation',
    })
  }
})

// 停止对话（包括 HITL 等待状态）
router.post('/conversations/:conversationId/stop', async (req: Request, res: Response) => {
  try {
    const conversationId = Array.isArray(req.params.conversationId)
      ? req.params.conversationId[0]
      : req.params.conversationId

    // 如果当前处于 HITL 等待状态，先取消 interrupt gate
    cancelInterrupt(conversationId)

    if (abortRun(conversationId)) {
      return res.json({
        code: 0,
        msg: 'Conversation stopped successfully',
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
    console.error('Error stopping conversation:', error)
    res.json({
      code: 1,
      error: error.message,
      msg: 'Failed to stop conversation',
    })
  }
})

export default router
