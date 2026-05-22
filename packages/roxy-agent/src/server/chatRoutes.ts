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
import { AbortError, abortRun, createAbort } from '../abortRegistry'
import { aiAgentUrl, env } from '../config'
import { ChatContextAPI } from '../database/conversations'
import { createChatAgent, createScriptAgent, deleteCheckpoint } from '../deepagents'
import { handleStream, StreamState } from '../deepagents/handle-stream'
import { isWorkerStart } from '../deepagents/tools/run_worker'
import { cancelInterrupt, createInterruptGate, resolveInterrupt } from '../interruptRegistry'
import { createLLM } from '../llm'
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
const IMAGE_SIZE_MAP: Record<string, Record<string, string>> = {
  '2K': {
    '1:1': '2048x2048',
    '4:3': '2304x1728',
    '3:4': '1728x2304',
    '16:9': '2848x1600',
    '9:16': '1600x2848',
    '3:2': '2496x1664',
    '2:3': '1664x2496',
    '21:9': '3136x1344',
  },
  '3K': {
    '1:1': '3072x3072',
    '4:3': '3456x2592',
    '3:4': '2592x3456',
    '16:9': '4096x2304',
    '9:16': '2304x4096',
    '3:2': '3744x2496',
    '2:3': '2496x3744',
    '21:9': '4704x2016',
  },
  '4K': {
    '1:1': '4096x4096',
    '4:3': '4704x3520',
    '3:4': '3520x4704',
    '16:9': '5504x3040',
    '9:16': '3040x5504',
    '3:2': '4992x3328',
    '2:3': '3328x4992',
    '21:9': '6240x2656',
  },
}

const router: Router = Router()

// 上传附件文件
router.post('/upload', (req: Request, res: Response) => {
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

    const ext = MIME_TO_EXT[finalMimeType] || ''
    const fileId = `${randomUUID()}${ext}`
    const filePath = path.join(uploadsDir, fileId)
    fs.writeFileSync(filePath, buffer)

    res.json({
      code: 0,
      msg: 'File uploaded successfully',
      data: {
        fileId,
        fileName,
        mimeType: finalMimeType,
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

    const filePath = path.join(uploadsDir, fileId)
    console.log('filePath', filePath)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ code: 1, msg: 'File not found' })
    }

    const ext = path.extname(fileId).toLowerCase()
    const mimeType = EXT_TO_MIME[ext] || 'application/octet-stream'
    return res.sendFile(fileId, {
      root: uploadsDir,
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
}

interface AssetGenerationOptions {
  aspectRatio?: string
  quality?: string
  count?: string
}

interface GeneratedImageRecord {
  fileId: string
  fileName: string
  mimeType?: string
  size?: number
  prompt?: string
}

function extractPositiveInteger(value: unknown, fallback: number) {
  const match = String(value ?? '').match(/\d+/)
  const parsed = match ? Number(match[0]) : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function resolveImageSize(options?: AssetGenerationOptions) {
  const quality = options?.quality === '4K' ? '4K' : '2K'
  const aspectRatio = options?.aspectRatio && IMAGE_SIZE_MAP[quality][options.aspectRatio]
    ? options.aspectRatio
    : '1:1'
  return IMAGE_SIZE_MAP[quality][aspectRatio]
}

function resolveGeneratedImageCount(options?: AssetGenerationOptions) {
  return Math.min(extractPositiveInteger(options?.count, 1), 4)
}

function getAttachmentFilePath(fileId: string) {
  return path.join(uploadsDir, fileId)
}

function getFileExtensionByMimeType(mimeType: string) {
  return MIME_TO_EXT[normalizeMimeType(mimeType)] || '.png'
}

function persistBufferAsUpload(buffer: Buffer, mimeType: string, prefix = 'generated') {
  const fileId = `${prefix}-${randomUUID()}${getFileExtensionByMimeType(mimeType)}`
  const filePath = getAttachmentFilePath(fileId)
  fs.writeFileSync(filePath, buffer)
  return {
    fileId,
    fileName: fileId,
    mimeType,
    size: buffer.length,
  }
}

function isDataUrl(url: string) {
  return /^data:/i.test(url)
}

async function readAttachmentAsDataUrl(att: AttachmentRef) {
  const filePath = att.fileId ? getAttachmentFilePath(att.fileId) : ''
  if (filePath && fs.existsSync(filePath)) {
    const base64 = fs.readFileSync(filePath).toString('base64')
    return `data:${att.mimeType};base64,${base64}`
  }

  if (att.url) {
    if (isDataUrl(att.url)) {
      return att.url
    }

    const response = await fetch(att.url)
    if (!response.ok) {
      throw new Error(`Failed to fetch attachment url: ${att.url}`)
    }
    const mimeType = normalizeMimeType(response.headers.get('content-type') || att.mimeType || 'image/png')
    const buffer = Buffer.from(await response.arrayBuffer())
    return `data:${mimeType};base64,${buffer.toString('base64')}`
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Attachment file not found: ${att.fileId}`)
  }
  const base64 = fs.readFileSync(filePath).toString('base64')
  return `data:${att.mimeType};base64,${base64}`
}

function buildAssetPrompt(message: string, options: AssetGenerationOptions) {
  const prompt = message.trim()
  const isZh = env.SYSTEM_LANGUAGE === 'zh-CN'
  const sections = isZh
    ? [
        '当前任务是生图生素材，请结合用户上传的参考图片理解主体、构图、风格、配色和材质信息。',
        `生成参数：画面比例 ${options.aspectRatio}，清晰度 ${options.quality}，数量 ${options.count}。`,
      ]
    : [
        'The current task is to generate image assets. Please analyze the reference images uploaded by the user to understand the subject, composition, style, color palette, and material.',
        `Generation parameters: aspect ratio ${options.aspectRatio}, quality ${options.quality}, count ${options.count}.`,
      ]

  if (prompt)
    sections.unshift(prompt)
  else
    sections.unshift(isZh ? '请基于参考图片生成符合上述参数的图片素材。' : 'Please generate image assets based on the reference images and the parameters above.')

  return sections.join('\n\n')
}

async function buildImageGenerationRequest(
  prompt: string,
  attachments: AttachmentRef[],
  options?: AssetGenerationOptions,
) {
  const imageInputs = await Promise.all(
    attachments
      .filter(att => att.mimeType.startsWith('image/'))
      .slice(0, 5)
      .map(readAttachmentAsDataUrl),
  )
  const count = resolveGeneratedImageCount(options)
  const payload: Record<string, any> = {
    // model: IMAGE_GENERATION_MODEL,
    prompt,
    size: resolveImageSize(options),
    watermark: false,
    // response_format: 'b64_json',
  }

  if (imageInputs.length > 0) {
    payload.image = imageInputs
  }

  if (count > 1) {
    payload.sequential_image_generation = 'auto'
    payload.sequential_image_generation_options = {
      max_images: count,
    }
  }

  return payload
}

async function persistGeneratedImages(result: any): Promise<GeneratedImageRecord[]> {
  const records = Array.isArray(result?.data) ? result.data : []
  const generatedImages: GeneratedImageRecord[] = []

  for (const item of records) {
    if (typeof item?.url === 'string' && item.url) {
      const response = await fetch(item.url)
      if (!response.ok) {
        throw new Error(`Failed to download generated image: ${item.url}`)
      }
      const mimeType = normalizeMimeType(response.headers.get('content-type') || item.mime_type || 'image/png')
      const buffer = Buffer.from(await response.arrayBuffer())
      generatedImages.push(persistBufferAsUpload(buffer, mimeType))
      continue
    }

    if (typeof item?.b64_json === 'string' && item.b64_json) {
      const buffer = Buffer.from(item.b64_json, 'base64')
      generatedImages.push(persistBufferAsUpload(buffer, normalizeMimeType(item.mime_type || 'image/png')))
      continue
    }
  }

  return generatedImages
}

/**
 * 构建 LangChain HumanMessage 的多模态内容数组
 */
function buildMessageContent(message: string, attachments: AttachmentRef[]): any[] | string {
  const parts: any[] = []
  const attachmentInfos: string[] = []
  const isZh = env.SYSTEM_LANGUAGE === 'zh-CN'

  if (message?.trim()) {
    parts.push({ type: 'text', text: message })
  }

  for (const att of attachments) {
    const filePath = getAttachmentFilePath(att.fileId)
    if (!fs.existsSync(filePath)) {
      console.warn(`Attachment file not found: ${att.fileId}`)
      continue
    }

    attachmentInfos.push(isZh
      ? `- 文件名: ${att.fileName}, 本地路径: ${filePath}, 类型: ${att.mimeType}`
      : `- filename: ${att.fileName}, local path: ${filePath}, type: ${att.mimeType}`)

    if (att.mimeType.startsWith('image/')) {
      const base64 = fs.readFileSync(filePath).toString('base64')
      parts.push({
        type: 'image_url',
        image_url: { url: `data:${att.mimeType};base64,${base64}` },
      })
    }
    else if (att.mimeType === 'text/plain') {
      const text = fs.readFileSync(filePath, 'utf-8')
      parts.push({ type: 'text', text: isZh ? `[文件: ${att.fileName}]\n${text}` : `[file: ${att.fileName}]\n${text}` })
    }
    else if (att.mimeType === 'application/pdf') {
      const base64 = fs.readFileSync(filePath).toString('base64')
      parts.push({
        type: 'image_url',
        image_url: { url: `data:application/pdf;base64,${base64}` },
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
    if (!fs.existsSync(filePath)) {
      console.warn(`Attachment file not found: ${att.fileId}`)
      continue
    }

    if (att.mimeType === 'text/plain') {
      const text = fs.readFileSync(filePath, 'utf-8')
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
  streamCallback: (event: string) => void,
): Promise<string> {
  const isZh = env.SYSTEM_LANGUAGE === 'zh-CN'
  const llm = await createLLM(false)
  const messageContent = buildMessageContentAsPlainText(userMessage, attachments)

  const structuredLlm = llm.withStructuredOutput(TitleOutputSchema, {
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

router.post('/images/generations', async (req: Request, res: Response) => {
  const {
    message,
    conversationId,
    attachments,
    assetOptions,
  } = req.body
  const attachmentList: AttachmentRef[] = Array.isArray(attachments) ? attachments : []
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

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const fileName = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  const sseFilePath = path.join(env.CHECKPOINT_DIR!, 'sse', `${fileName}.sse`)

  const sseLogger = sseLoggerManager.createLogger(sseFilePath)

  const streamCallback = (event: string) => {
    res.write(event)
    sseLogger.log(event)
    if (typeof (res as any).flush === 'function') {
      (res as any).flush()
    }
  }

  // SSE 建立后立即告知前端开始生成，携带图片数量用于占位
  const count = resolveGeneratedImageCount(assetOptions)
  streamCallback(streamAdapter.imageGenerating({ count }))

  const startTime = Date.now()

  try {
    ChatContextAPI.setActiveConversation(conversationId)

    ChatContextAPI.addMessage({
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      conversation_id: conversationId,
      role: 'user',
      content: prompt,
      content_type: 'text',
      storage_type: 'inline',
      agent_mode: 'simple',
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
      agent_mode: 'simple',
      metadata: {
        timestamp: Date.now(),
        source: 'sse_stream',
        assetOptions,
      },
    })

    if (conversation.is_title_set === 0 || conversation.is_title_set === undefined) {
      await generateConversationTitle(prompt, attachmentList, streamCallback)
        .then((generatedTitle) => {
          if (generatedTitle) {
            ChatContextAPI.updateConversation(conversationId, { title: generatedTitle })
          }
        })
        .catch((err) => {
          console.error('Failed to generate title:', err)
        })
    }

    const payload = {
      ...await buildImageGenerationRequest(buildAssetPrompt(prompt, assetOptions), attachmentList, assetOptions),
      stream: true,
    }

    const upstreamResponse = await fetch(`${aiAgentUrl}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.ROXY_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text()
      console.error('Upstream image generation failed:', errorText)
      let errorResult: any = {}
      try { errorResult = errorText ? JSON.parse(errorText) : {} }
      catch {}
      streamCallback(streamAdapter.error(errorResult?.error?.message || errorResult?.message || 'Image generation failed', upstreamResponse.status))
      streamCallback(streamAdapter.done())
      res.end()
      return
    }

    // Parse upstream SSE stream — push each image as soon as it's ready
    const reader = upstreamResponse.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let completedEvent: any = null
    // index → persisted record, built incrementally
    const partialImages: Map<number, GeneratedImageRecord & { prompt?: string }> = new Map()

    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break

      buffer += decoder.decode(value, { stream: true })

      let splitIndex: number
      while (true) {
        splitIndex = buffer.search(/\r?\n\r?\n/)
        if (splitIndex === -1)
          break

        const rawBlock = buffer.slice(0, splitIndex)
        buffer = buffer.slice(splitIndex).replace(/^\r?\n\r?\n/, '')

        for (const line of rawBlock.split(/\r?\n/)) {
          if (!line.startsWith('data:'))
            continue
          const data = line.slice(5).trim()
          if (data === '[DONE]')
            continue
          let parsed: any
          try { parsed = JSON.parse(data) }
          catch { continue }

          if (parsed?.type === 'image_generation.partial_succeeded') {
            // Download and persist this image immediately
            const index: number = parsed.image_index ?? 0
            try {
              const [record] = await persistGeneratedImages({ data: [{ url: parsed.url, b64_json: parsed.b64_json, mime_type: parsed.mime_type }] })
              if (record) {
                const imageWithPrompt = { ...record, prompt }
                partialImages.set(index, imageWithPrompt)
                streamCallback(streamAdapter.imagePartial({ index, image: imageWithPrompt }))
              }
            }
            catch (err: any) {
              console.error('Failed to persist partial image:', err)
            }
          }
          else if (parsed?.type === 'image_generation.completed') {
            completedEvent = parsed
          }
        }
      }
    }

    if (partialImages.size === 0) {
      streamCallback(streamAdapter.error('No generated images returned'))
      streamCallback(streamAdapter.done())
      res.end()
      return
    }

    streamCallback(streamAdapter.done())
  }
  catch (error: any) {
    console.error('Error generating image:', error)
    streamCallback(streamAdapter.error(error.message))
    streamCallback(streamAdapter.done())
  }
  finally {
    const endTime = Date.now()
    ;(process as any).parentPort?.postMessage({
      event: 'save_chat_message',
      data: {
        conversationId,
        file: sseFilePath,
        message: prompt,
        inputToken: 0,
        outputToken: 0,
        time: endTime - startTime,
        taskType: 'simple',
      },
    })
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
  const attachmentList: AttachmentRef[] = Array.isArray(attachments) ? attachments : []

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
  const agentMode = mode
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

  // 如果标题还没有设置，就生成标题
  if (conversation.is_title_set === 0 || conversation.is_title_set === undefined) {
    await generateConversationTitle(message || '', attachmentList, streamCallback)
      .then((generatedTitle) => {
        if (generatedTitle) {
          ChatContextAPI.updateConversation(conversationId, { title: generatedTitle })
        }
      })
      .catch((err) => {
        console.error('Failed to generate title:', err)
      })
  }

  const startTime = Date.now()
  const { agent, destroy } = await (script ? createScriptAgent : createChatAgent)({
    mode: agentMode,
    conversationId,
  })

  try {
    const config = {
      configurable: {
        thread_id: conversation.thread_id,
      },
      streamMode: ['messages', 'custom', 'tools', 'updates'],
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

    const state = new StreamState()

    // 检查是否有 pending interrupt（用户可能关闭软件后重新打开）
    // 如果有，必须先处理 interrupt，不能接受新消息
    const checkpointer = (agent as any).checkpointer
    let invokeInput: any = input

    if (checkpointer) {
      const state = await agent.getState(config)
      if (state.next && state.next.length > 0) {
        // 有 pending interrupt，使用 null 输入触发 interrupt
        invokeInput = null
      }
    }

    // 支持多轮 interrupt：每次 invoke 后检查是否有 __interrupt__，有则等待用户决策后继续
    while (true) {
      const stream = await agent.stream(invokeInput, config)
      let interrupted = false
      let interruptValue: any = null

      for await (const rawChunk of stream) {
        const [namespace, chunk] = rawChunk

        // 检测 __interrupt__ 事件（deepagents 通过 custom namespace 推送）
        if (chunk?.__interrupt__) {
          interrupted = true
          interruptValue = chunk.__interrupt__
          continue
        }

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
    await destroy()

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

/** 从上游错误消息中提取 HTTP 状态码，如 "402 \"Insufficient balance\"" → 402 */
function extractHttpErrorCode(message: string): number | undefined {
  const match = message?.match(/\b([45]\d{2})\b/)
  return match ? Number(match[1]) : undefined
}

export default router
