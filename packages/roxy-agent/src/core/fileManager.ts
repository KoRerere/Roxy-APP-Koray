import type { FileRecord } from '@/database/conversations'
import type { Buffer } from 'node:buffer'
import type { FileUploadOptions, FileUploadResult } from '@/api/agentApiClient'
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { agentFilesApi } from '@/api/agentApiClient'
import { agentPaths } from '@/core/storage/agentPaths'
import { FileRecordStore } from '@/database/conversations'

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
  'application/pdf': '.pdf',
  'application/json': '.json',
  'text/typescript': '.ts',
  'text/plain': '.txt',
  'text/markdown': '.md',
  'text/x-markdown': '.md',
  'text/csv': '.csv',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/mpeg': '.mpeg',
  'video/x-msvideo': '.avi',
}

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.ts': 'text/typescript',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.csv': 'text/csv',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mpeg': 'video/mpeg',
  '.avi': 'video/x-msvideo',
  '.zip': 'application/zip',
}

const SCRIPT_MIME_BY_EXTENSION: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.cjs': 'text/javascript',
  '.ts': 'text/typescript',
  '.tsx': 'text/typescript',
  '.jsx': 'text/javascript',
}

const TEXT_ARTIFACT_EXTENSIONS = new Set([
  '.md',
  '.markdown',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.less',
  '.xml',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.sh',
  '.bash',
  '.zsh',
  '.sql',
])

const EXTENSION_PREFERRED_MIME_TYPES = new Set([
  '',
  'application/octet-stream',
  'binary/octet-stream',
  'video/mp2t',
])

/** 规范化 MIME（去参数、小写，image/jpg → image/jpeg） */
export function normalizeMimeType(mimeType?: string): string {
  const normalized = (mimeType || '').split(';')[0].trim().toLowerCase()
  return normalized === 'image/jpg' ? 'image/jpeg' : normalized
}

export function mimeToExt(mimeType?: string): string {
  return MIME_TO_EXT[normalizeMimeType(mimeType)] || ''
}

export function extToMime(nameOrPath: string): string | undefined {
  return EXT_TO_MIME[path.extname(nameOrPath).toLowerCase()]
}

/**
 * MIME accepted by the agent file service for generated conversation files.
 * Markdown and other text formats are uploaded as text/plain because the
 * endpoint intentionally accepts text rather than arbitrary document types.
 * Unknown binary extensions return undefined so one unsupported artifact does
 * not poison the rest of a conversation's upload batch.
 */
export function generatedArtifactMimeType(nameOrPath: string): string | undefined {
  const extension = path.extname(nameOrPath).toLowerCase()
  if (SCRIPT_MIME_BY_EXTENSION[extension]) {
    return SCRIPT_MIME_BY_EXTENSION[extension]
  }
  if (TEXT_ARTIFACT_EXTENSIONS.has(extension)) {
    return 'text/plain'
  }
  return EXT_TO_MIME[extension]
}

export function resolveFileMimeType(mimeType?: string, fileName?: string): string {
  const normalized = normalizeMimeType(mimeType)
  const inferred = fileName ? extToMime(fileName) : undefined
  if (inferred && EXTENSION_PREFERRED_MIME_TYPES.has(normalized)) {
    return inferred
  }
  return normalized || inferred || 'application/octet-stream'
}

/** 进程内并发去重：同一本地文件的并发上传共享同一个 Promise，避免重复打 OSS */
const uploadTasks = new Map<string, Promise<string | undefined>>()

/** 由 fileId 解析出的完整附件信息（结构与 server 层 AttachmentRef 对齐） */
export interface ResolvedAttachment {
  fileId: string
  fileName: string
  mimeType: string
  size?: number
  url?: string
  localUrl?: string
  remoteUrl?: string
  fileUrl?: string
  upstreamFileId?: string
  upstreamFileService?: string
}

export interface SaveBufferInput {
  buffer: Buffer
  fileName?: string
  mimeType?: string
  source?: string
  /** true：同步等待 OSS 上传完成（沿用 /api/upload 语义）；false（默认）：懒上传，后续 resolveRemoteUrl 时再传 */
  uploadNow?: boolean
  /** 仅输入图片使用：forward=true 时 v3 同时上传到模型对应的文件服务。 */
  uploadOptions?: FileUploadOptions
  /** file_id 前缀；不传则按 source 推断（generated → 'generated'） */
  prefix?: string
  /** 单次保存的目标目录；不传则使用全局 orphaned uploads 兼容旧入口 */
  uploadsDir?: string
}

/**
 * 统一的文件管理器：唯一持有本地 uploadsDir，封装
 *   写本地 + sha256 内容去重 + OSS 上传/复用 + 元信息入库（files 表）+ 按 fileId 查询/寻址/读取。
 *
 * 去重语义（物理去重、逻辑保留）：每次 saveBuffer 都生成独立 file_id 与独立 files 记录
 * （尊重用户多次上传相同图片），但相同内容 hash 的记录共享同一 local_path 与 oss_url。
 */
export class FileManager {
  /**
   * 未指定会话时仍落到兼容旧入口的非归属桶；新对话附件可通过 saveBuffer(uploadsDir) 写入会话目录。
   */
  readonly uploadsDir = agentPaths.orphanedUploadsDir

  ensureDir(): void {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true })
    }
  }

  private hashBuffer(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex')
  }

  private generateFileId(mimeType?: string, prefix?: string): string {
    const base = `${randomUUID()}${mimeToExt(mimeType)}`
    return prefix ? `${prefix}-${base}` : base
  }

  /**
   * 读取本地文件并上传到 AI Agent 服务端（OSS），返回永久可访问 URL。
   * 失败返回 undefined（吞掉异常，由调用方决定是否回退/报错）。
   */
  private async uploadLocalFile(
    file: { fileId?: string, fileName?: string, filePath: string, mimeType?: string },
    options: FileUploadOptions = {},
  ): Promise<FileUploadResult> {
    const filename = file.fileName || path.basename(file.filePath)
    const contentType = resolveFileMimeType(file.mimeType, filename || file.filePath)
    const buffer = await fs.promises.readFile(file.filePath)
    const blob = new Blob([new Uint8Array(buffer)], { type: contentType })
    return agentFilesApi.upload(blob, filename, options)
  }

  private async uploadLocalFileToOss(file: { fileId?: string, fileName?: string, filePath: string, mimeType?: string }): Promise<string | undefined> {
    const result = await this.uploadLocalFile(file)
    const ossUrl = result.url
    if (typeof ossUrl !== 'string' || !ossUrl) {
      throw new Error('File upload response did not include url')
    }
    return ossUrl
  }

  /** 带进程内并发去重的 OSS 上传：同一文件并发调用复用同一 Promise；失败返回 undefined */
  private uploadToOss(file: { fileId?: string, fileName?: string, filePath: string, mimeType?: string }): Promise<string | undefined> {
    const key = file.fileId || path.resolve(file.filePath)
    const existing = uploadTasks.get(key)
    if (existing) {
      return existing
    }

    const task = this.uploadLocalFileToOss(file)
      .catch((error) => {
        console.error('File server upload failed:', error)
        return undefined
      })
      .then((remoteUrl) => {
        if (!remoteUrl) {
          uploadTasks.delete(key)
        }
        return remoteUrl
      })

    uploadTasks.set(key, task)
    return task
  }

  /**
   * 保存一份内容并入库，返回新建的文件记录。
   * 相同 hash 已存在且本地物理文件仍在时，复用其 local_path 与 oss_url（不写新文件、不重传 OSS）。
   */
  async saveBuffer(input: SaveBufferInput): Promise<FileRecord> {
    this.ensureDir()
    const uploadsDir = input.uploadsDir || this.uploadsDir
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }
    const mimeType = resolveFileMimeType(input.mimeType, input.fileName)
    const buffer = input.buffer
    const hash = this.hashBuffer(buffer)
    const prefix = input.prefix ?? (input.source === 'generated' ? 'generated' : undefined)
    const fileId = this.generateFileId(mimeType, prefix)

    const existing = FileRecordStore.getByHashAny(hash)
    let localPath: string
    let ossUrl: string | null = null
    let upstreamFileId: string | null = null
    let upstreamFileService: string | null = null

    if (!input.uploadsDir && existing?.local_path && fs.existsSync(existing.local_path)) {
      // 物理去重：复用已有本地文件与（如已具备的）OSS URL
      localPath = existing.local_path
      ossUrl = existing.oss_url ?? null
    }
    else {
      localPath = path.join(uploadsDir, fileId)
      fs.writeFileSync(localPath, buffer)
      ossUrl = existing?.oss_url ?? null
    }

    if (input.uploadNow && input.uploadOptions?.forward) {
      const result = await this.uploadLocalFile(
        { fileId, fileName: input.fileName, filePath: localPath, mimeType },
        input.uploadOptions,
      )
      if (!result.upstream_file_id) {
        throw new Error('Forwarded file upload response did not include upstream_file_id')
      }
      ossUrl = result.url
      upstreamFileId = result.upstream_file_id
      upstreamFileService = result.upstream_service ?? null
    }
    else if (!ossUrl && input.uploadNow) {
      ossUrl = (await this.uploadToOss({ fileId, fileName: input.fileName, filePath: localPath, mimeType })) ?? null
    }

    return FileRecordStore.insert({
      file_id: fileId,
      file_name: input.fileName ?? null,
      local_path: localPath,
      oss_url: ossUrl,
      upstream_file_id: upstreamFileId,
      upstream_file_service: upstreamFileService,
      mime_type: mimeType,
      size: buffer.length,
      hash,
      source: input.source ?? 'upload',
    })
  }

  /**
   * 登记一个已存在于本地的文件（历史 fileId 或前端回传的附件兜底入库）。
   * 文件不存在时返回 null。
   */
  registerLocalFile(input: { fileId: string, fileName?: string, mimeType?: string, filePath?: string, ossUrl?: string, source?: string }): FileRecord | null {
    const filePath = input.filePath || path.join(this.uploadsDir, input.fileId)
    if (!fs.existsSync(filePath)) {
      return null
    }
    const buffer = fs.readFileSync(filePath)
    const mimeType = normalizeMimeType(input.mimeType) || extToMime(input.fileId) || 'application/octet-stream'
    return FileRecordStore.insert({
      file_id: input.fileId,
      file_name: input.fileName ?? input.fileId,
      local_path: filePath,
      oss_url: input.ossUrl ?? null,
      upstream_file_id: null,
      upstream_file_service: null,
      mime_type: mimeType,
      size: buffer.length,
      hash: this.hashBuffer(buffer),
      source: input.source ?? 'upload',
    })
  }

  /** 按 fileId 查记录；DB 未命中但本地存在则补登记（向后兼容历史文件） */
  get(fileId: string): FileRecord | null {
    if (!fileId) {
      return null
    }
    const record = FileRecordStore.getByFileId(fileId)
    if (record) {
      return record
    }
    if (fs.existsSync(path.join(this.uploadsDir, fileId))) {
      return this.registerLocalFile({ fileId })
    }
    return null
  }

  /**
   * 解析上传文件的本地物理路径，容忍历史绝对 local_path 失效。
   *
   * DB 里的 local_path 是写入时的绝对路径，数据目录迁移/换机后会失效。fileId 唯一（也是物理文件名），
   * 故按优先级：现存的 local_path > 当前 uploadsDir/basename(local_path) > uploadsDir/fileId。
   * 保证任意重定位后旧附件仍可被读到。
   */
  private resolveLocalPath(recordLocalPath: string | null | undefined, fileId: string): string {
    if (recordLocalPath && fs.existsSync(recordLocalPath)) {
      return recordLocalPath
    }
    if (recordLocalPath) {
      const relocated = path.join(this.uploadsDir, path.basename(recordLocalPath))
      if (fs.existsSync(relocated)) {
        return relocated
      }
    }
    return path.join(this.uploadsDir, fileId)
  }

  /** 本地物理路径（去重条目指向首次上传的文件，故必须查 DB；未命中/失效回退当前 uploadsDir） */
  getLocalPath(fileId: string): string {
    const record = FileRecordStore.getByFileId(fileId)
    return this.resolveLocalPath(record?.local_path, fileId)
  }

  exists(fileId: string): boolean {
    const localPath = this.getLocalPath(fileId)
    return Boolean(localPath) && fs.existsSync(localPath)
  }

  /**
   * 删除某对话消息引用的本地上传附件。
   * 删除对话时调用。因 files 表按 hash 去重（多 file_id 共享同一物理文件），
   * 只有删掉某物理文件的最后一条引用时才真正 rm 物理文件，避免误删其它对话仍在用的附件。
   * 仅清理本地物理文件与 files 记录，不动 OSS 远端。
   */
  deleteConversationFiles(conversationId: string): void {
    const fileIds = FileRecordStore.getConversationFileIds(conversationId)
    for (const fileId of fileIds) {
      try {
        const { localPath, lastRef } = FileRecordStore.deleteFileRecord(fileId)
        if (!lastRef) {
          continue
        }
        // 删物理文件：原 local_path + basename 回退到当前 uploadsDir（容忍迁移后失效）+ uploadsDir/fileId
        const candidates = new Set<string>()
        if (localPath) {
          candidates.add(localPath)
          candidates.add(path.join(this.uploadsDir, path.basename(localPath)))
        }
        candidates.add(path.join(this.uploadsDir, fileId))
        for (const p of candidates) {
          try {
            fs.rmSync(p, { force: true })
          }
          catch {
            // 忽略单个文件删除失败
          }
        }
      }
      catch (err: any) {
        console.warn(`删除附件文件失败 fileId=${fileId}:`, err?.message)
      }
    }
  }

  readBuffer(fileId: string): Buffer {
    return fs.readFileSync(this.getLocalPath(fileId))
  }

  /** 文件 MIME（DB 优先，回退按扩展名推断） */
  resolveMimeType(fileId: string, hint?: string): string {
    const record = FileRecordStore.getByFileId(fileId)
    return resolveFileMimeType(record?.mime_type || hint, record?.file_name || fileId)
  }

  /**
   * 确保拿到 OSS URL：DB 命中直接返回；否则按 hash 复用已上传结果；再否则上传本地文件并按 hash 回填。
   * 文件不存在或上传失败返回 undefined。
   */
  async resolveRemoteUrl(fileId: string): Promise<string | undefined> {
    const record = this.get(fileId)
    if (!record) {
      return undefined
    }
    if (record.oss_url) {
      return record.oss_url
    }

    if (record.hash) {
      const hit = FileRecordStore.getByHashWithOss(record.hash)
      if (hit?.oss_url) {
        FileRecordStore.setOssByHash(record.hash, hit.oss_url)
        return hit.oss_url
      }
    }

    const localPath = this.resolveLocalPath(record.local_path, fileId)
    if (!fs.existsSync(localPath)) {
      return undefined
    }

    const ossUrl = await this.uploadToOss({
      fileId,
      fileName: record.file_name ?? undefined,
      filePath: localPath,
      mimeType: record.mime_type ?? undefined,
    })
    if (ossUrl) {
      if (record.hash) {
        FileRecordStore.setOssByHash(record.hash, ossUrl)
      }
      else {
        FileRecordStore.setOssById(fileId, ossUrl)
      }
    }
    return ossUrl
  }

  /**
   * 由 fileId 解析出完整附件信息（fileName / mimeType / size / 本地与远程 URL）。
   * 前端只回传 fileId 时用于补全；DB 未命中则用入参 partial 兜底。
   * 不触发上传：remoteUrl 仅取已落库的 oss_url（需要时调用方再用 resolveRemoteUrl 异步获取）。
   */
  toAttachmentRef(fileId: string, partial: Partial<ResolvedAttachment> = {}): ResolvedAttachment {
    const record = this.get(fileId)
    const hasLocal = this.exists(fileId)
    const fileName = record?.file_name || partial.fileName || fileId
    const mimeType = resolveFileMimeType(record?.mime_type || partial.mimeType, fileName)
    const remoteUrl = record?.oss_url || partial.remoteUrl || partial.fileUrl || undefined
    const upstreamFileId = record?.upstream_file_id || partial.upstreamFileId || undefined
    const upstreamFileService = record?.upstream_file_service || partial.upstreamFileService || undefined
    const localUrl = hasLocal ? `/api/files/${fileId}` : (partial.localUrl || partial.url)
    return {
      fileId,
      fileName,
      mimeType,
      size: record?.size ?? partial.size,
      url: localUrl || remoteUrl || partial.url,
      localUrl,
      remoteUrl,
      fileUrl: remoteUrl,
      upstreamFileId,
      upstreamFileService,
    }
  }
}

export const fileManager = new FileManager()
