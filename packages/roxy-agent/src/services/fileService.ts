import { Buffer } from 'node:buffer'
import { fileManager, resolveFileMimeType } from '@/core/fileManager'
import { agentPaths } from '@/core/storage/agentPaths'
import { FileRecordStore } from '@/database/conversations'
import { env } from '../config'

const INLINE_TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/typescript',
  'application/json',
  'text/markdown',
  'text/x-markdown',
])

const MAX_FILE_SIZE_MB = 100
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024

export function normalizeMimeType(mimeType: string) {
  return mimeType.split(';')[0].trim().toLowerCase()
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
  conversationId?: string
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
 * 处理附件上传：保留客户端 MIME（未知类型兜底为 application/octet-stream），校验大小，
 * 写本地 + sha256 去重 + 同步上传 OSS + 元信息入库。
 * 大小校验失败抛 Error（由路由捕获转 `{ code: 1, msg }`）。
 */
export async function saveUpload(input: UploadInput): Promise<UploadResult> {
  const { data, mimeType, fileName, conversationId } = input

  const { base64, mimeType: detectedMimeType } = extractBase64Payload(data)
  const finalMimeType = resolveFileMimeType(detectedMimeType ?? mimeType, fileName)

  const buffer = Buffer.from(base64, 'base64')
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit`)
  }

  // 统一交给 FileManager：写本地 + sha256 去重 + 同步上传 OSS + 元信息入库
  const record = await fileManager.saveBuffer({
    buffer,
    fileName,
    mimeType: finalMimeType,
    source: 'upload',
    uploadNow: true,
    ...(conversationId ? { uploadsDir: agentPaths.sessionUploadsDir(conversationId) } : {}),
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

export async function resolveAttachmentRemoteUrl(att: AttachmentRef) {
  // 前端回传的远程 URL 可信，优先复用；否则交给 FileManager（按 hash 去重 / 上传 / 回填）
  const direct = asRemoteFileUrl(att.remoteUrl) || asRemoteFileUrl(att.fileUrl)
  if (direct)
    return direct
  return fileManager.resolveRemoteUrl(att.fileId)
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException('User cancelled', 'AbortError')
}

async function awaitWithSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) {
    return promise
  }
  if (signal.aborted) {
    throw abortReason(signal)
  }

  let onAbort: (() => void) | undefined
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(abortReason(signal))
    signal.addEventListener('abort', onAbort, { once: true })
  })

  try {
    return await Promise.race([promise, aborted])
  }
  finally {
    if (onAbort) {
      signal.removeEventListener('abort', onAbort)
    }
  }
}

export async function hydrateAttachmentFileUrls(
  attachments: Array<Partial<AttachmentRef> & { fileId: string }>,
  signal?: AbortSignal,
) {
  return Promise.all(attachments.map(async (input) => {
    // 前端仅回传 fileId，其余信息（fileName/mimeType/size/本地与远程 URL）由 FileManager 从 files 表补全
    const att = fileManager.toAttachmentRef(input.fileId, input)
    const remoteUrl = await awaitWithSignal(resolveAttachmentRemoteUrl(att), signal)
    return {
      ...att,
      ...(remoteUrl ? { remoteUrl, fileUrl: remoteUrl } : {}),
    }
  }))
}

/**
 * 构建 HumanMessage 文本：文本类附件内联全文，其余类型只写本地路径与元数据。
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
