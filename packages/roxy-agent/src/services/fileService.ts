import { Buffer } from 'node:buffer'
import path from 'node:path'
import { fileManager } from '@/core/fileManager'
import { FileRecordStore } from '@/database/conversations'
import { env } from '../config'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'application/pdf',
  'text/plain',
  'application/json',
  'text/markdown',
  'text/x-markdown',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

const EXTENSION_MIME_TYPES: Record<string, string> = {
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
}

const INLINE_TEXT_MIME_TYPES = new Set([
  'text/plain',
  'application/json',
  'text/markdown',
  'text/x-markdown',
])

/**
 * 5MB
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024

export function normalizeMimeType(mimeType: string) {
  return mimeType.split(';')[0].trim().toLowerCase()
}

function resolveUploadMimeType(mimeType: string, fileName: string) {
  const normalized = normalizeMimeType(mimeType)
  if (normalized && normalized !== 'application/octet-stream')
    return normalized

  return EXTENSION_MIME_TYPES[path.extname(fileName).toLowerCase()] || normalized
}

export function extractBase64Payload(data: string) {
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

export interface UploadInput {
  data: string
  mimeType: string
  fileName: string
}

export interface UploadResult {
  fileId: string
  fileName: string
  mimeType: string
  size: number
  url: string
  localUrl: string
  remoteUrl?: string
  fileUrl?: string
}

/**
 * 处理附件上传：校验 MIME 与大小，写本地 + sha256 去重 + 同步上传 OSS + 元信息入库。
 * 校验失败抛 Error（由路由捕获转 `{ code: 1, msg }`）。
 */
export async function saveUpload(input: UploadInput): Promise<UploadResult> {
  const { data, mimeType, fileName } = input

  const normalizedMimeType = resolveUploadMimeType(mimeType, fileName)
  const { base64, mimeType: detectedMimeType } = extractBase64Payload(data)
  const finalMimeType = detectedMimeType
    ? resolveUploadMimeType(detectedMimeType, fileName)
    : normalizedMimeType

  if (!ALLOWED_MIME_TYPES.has(finalMimeType)) {
    throw new Error(`Unsupported file type: ${finalMimeType}`)
  }

  const buffer = Buffer.from(base64, 'base64')
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error('File size exceeds 5MB limit')
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

  return {
    fileId: record.file_id,
    fileName,
    mimeType: record.mime_type || finalMimeType,
    size: record.size ?? buffer.length,
    url: localUrl,
    localUrl,
    ...(record.oss_url ? { remoteUrl: record.oss_url, fileUrl: record.oss_url } : {}),
  }
}

/**
 * 解析待下发文件的本地路径与 MIME，供路由 `res.sendFile` 使用。
 * 非法 fileId 或文件不存在时返回带 status 的错误（由路由转响应）。
 */
export function resolveServeFile(fileId: string):
  | { ok: true, filePath: string, mimeType: string, fileName: string }
  | { ok: false, status: number, msg: string } {
  // 安全校验：只允许字母数字、连字符、点
  if (!/^[\w\-.]+$/.test(fileId)) {
    return { ok: false, status: 400, msg: 'Invalid file ID' }
  }

  const filePath = fileManager.getLocalPath(fileId)
  if (!fileManager.exists(fileId)) {
    return { ok: false, status: 404, msg: 'File not found' }
  }

  const record = FileRecordStore.getByFileId(fileId)
  const mimeType = fileManager.resolveMimeType(fileId)
  return { ok: true, filePath, mimeType, fileName: record?.file_name || fileId }
}

// 附件类型定义
export interface AttachmentRef {
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

export async function resolveAttachmentRemoteUrl(att: AttachmentRef, options: { required?: boolean } = {}) {
  // 前端回传的远程 URL 可信，优先复用；否则交给 FileManager（按 hash 去重 / 上传 / 回填）
  const direct = asRemoteFileUrl(att.remoteUrl) || asRemoteFileUrl(att.fileUrl)
  if (direct)
    return direct
  const remoteUrl = await fileManager.resolveRemoteUrl(att.fileId)
  if (!remoteUrl && options.required)
    throw new Error(`Failed to upload attachment to file server: ${att.fileName || att.fileId}`)
  return remoteUrl
}

export async function hydrateAttachmentFileUrls(attachments: Array<Partial<AttachmentRef> & { fileId: string }>) {
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
export async function buildMessageContent(
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
    else if (INLINE_TEXT_MIME_TYPES.has(normalizeMimeType(att.mimeType))) {
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
 * 纯文本 HumanMessage：文本类附件内联全文，其余类型只写本地路径与元数据（兼容不支持多模态的模型）。
 * 需要 base64 图片/PDF 等多模态时请用 `buildMessageContent`，并在请求中传 `multimodalAttachments: true`。
 */
export function buildMessageContentAsPlainText(message: string, attachments: AttachmentRef[]): string {
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

    if (INLINE_TEXT_MIME_TYPES.has(normalizeMimeType(att.mimeType))) {
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
