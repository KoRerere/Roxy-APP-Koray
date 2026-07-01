import type { FileRecord } from '@/database/conversations'
import { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { aiAgentFilesApi } from '@/api/files'
import { FileRecordStore } from '@/database/conversations'
import { env } from '../config'

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
}

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

// "MPF\0"：MPO 多图容器在 APP2 段携带的标识符（Multi Picture Format）
const MPF_IDENTIFIER = Buffer.from([0x4D, 0x50, 0x46, 0x00])
// 仅在文件头部一定范围内查找 MPF（MPF APP2 段位于主图起始的 APP 段区，远早于扫描数据）
const MPF_SCAN_LIMIT = 262144

function readUint16(buf: Buffer, off: number, le: boolean): number {
  return le ? buf.readUInt16LE(off) : buf.readUInt16BE(off)
}

function readUint32(buf: Buffer, off: number, le: boolean): number {
  return le ? buf.readUInt32LE(off) : buf.readUInt32BE(off)
}

/** 是否为 MPO 多图容器：JPEG 魔数 + 头部范围内出现 MPF APP2 标识。 */
function looksLikeMpo(buf: Buffer): boolean {
  if (buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8 || buf[2] !== 0xFF)
    return false
  return buf.subarray(0, MPF_SCAN_LIMIT).includes(MPF_IDENTIFIER)
}

/** 删除 JPEG 中的 MPF APP2 段（FFE2 + "MPF\0"），使其不再被识别为 MPO。返回新 Buffer。 */
function stripMpfSegment(frame: Buffer): Buffer {
  let p = 2
  while (p + 4 <= frame.length) {
    if (frame[p] !== 0xFF)
      break
    const marker = frame[p + 1]
    if (marker === 0xDA) // SOS：之后为扫描数据，停止扫描 APP 段
      break
    const segLen = frame.readUInt16BE(p + 2)
    const segEnd = p + 2 + segLen
    if (segEnd > frame.length)
      break
    if (marker === 0xE2 && frame.subarray(p + 4, p + 8).equals(MPF_IDENTIFIER))
      return Buffer.concat([frame.subarray(0, p), frame.subarray(segEnd)])
    p = segEnd
  }
  // 理论上不会到这（detection 已确认含 MPF）：返回独立拷贝，避免返回原 buffer 的视图
  return Buffer.from(frame)
}

/**
 * 从 MPO 提取第一个 MPF 图像（即全分辨率主图）并剥离 MPF APP2 段，得到标准 JPEG。
 *
 * MPO 结构：第一个 MPF 图像本身是一段完整、独立的标准 JPEG（含全分辨率主图），其后
 * 拼接深度/视差等附加图像；文件被判为 mpo 的唯一原因是第一帧带了 MPF APP2 段。故只需
 * 按 MPF 索引切出第一帧、再删掉该 APP2 段即可，纯字节切片、零重编码、EXIF 朝向天然保留。
 *
 * 解析失败返回 null。
 */
function extractMpoFirstJpeg(buf: Buffer): Buffer | null {
  if (buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8 || buf[2] !== 0xFF)
    return null
  const mpfPos = buf.subarray(0, MPF_SCAN_LIMIT).indexOf(MPF_IDENTIFIER)
  if (mpfPos === -1)
    return null

  // MPF\0 之后紧跟 TIFF header，是 MP Index IFD 内所有偏移的基准原点
  const tiff = mpfPos + 4
  if (tiff + 8 > buf.length)
    return null
  const le = buf.toString('latin1', tiff, tiff + 2) === 'II'

  let firstSize: number | null = null
  try {
    const ifd = tiff + readUint32(buf, tiff + 4, le)
    const count = readUint16(buf, ifd, le)
    for (let k = 0; k < count; k++) {
      const e = ifd + 2 + k * 12
      if (readUint16(buf, e, le) === 0xB002) { // MPEntry tag：各图像的属性/大小/偏移表
        const valOff = readUint32(buf, e + 8, le)
        firstSize = readUint32(buf, tiff + valOff + 4, le) // 第 0 个 MP Entry 的 size 字段
        break
      }
    }
  }
  catch {
    return null
  }
  if (!firstSize || firstSize < 4 || firstSize > buf.length)
    return null

  return stripMpfSegment(buf.subarray(0, firstSize))
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
}

export interface SaveBufferInput {
  buffer: Buffer
  fileName?: string
  mimeType?: string
  source?: 'upload' | 'generated' | string
  /** true：同步等待 OSS 上传完成（沿用 /api/upload 语义）；false（默认）：懒上传，后续 resolveRemoteUrl 时再传 */
  uploadNow?: boolean
  /** file_id 前缀；不传则按 source 推断（generated → 'generated'） */
  prefix?: string
  /** 预置远程 URL（如生成图的上游可访问地址）：存为 oss_url 并跳过上传 */
  ossUrl?: string
}

/**
 * 统一的文件管理器：唯一持有本地 uploadsDir，封装
 *   写本地 + sha256 内容去重 + OSS 上传/复用 + 元信息入库（files 表）+ 按 fileId 查询/寻址/读取。
 *
 * 去重语义（物理去重、逻辑保留）：每次 saveBuffer 都生成独立 file_id 与独立 files 记录
 * （尊重用户多次上传相同图片），但相同内容 hash 的记录共享同一 local_path 与 oss_url。
 */
export class FileManager {
  readonly uploadsDir = path.join(env.CHECKPOINT_DIR, 'uploads')

  ensureDir(): void {
    if (!fs.existsSync(this.uploadsDir))
      fs.mkdirSync(this.uploadsDir, { recursive: true })
  }

  private hashBuffer(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex')
  }

  private generateFileId(mimeType?: string, prefix?: string): string {
    const base = `${randomUUID()}${mimeToExt(mimeType)}`
    return prefix ? `${prefix}-${base}` : base
  }

  /**
   * 按需把上传内容归一化为上游可识别的标准格式。当前处理 iPhone 的 MPO 多图容器
   * （文件名 .jpg、魔数与 JPEG 相同、但含 MPF APP2 段）：提取其全分辨率主图并剥离 MPF
   * 段，得到标准 JPEG，避免下游图生图 / VLM 读图被上游以 "Unsupported image format: mpo"
   * 拒绝。纯字节切片、零重编码、EXIF 朝向保留。
   *
   * 非 MPO（普通 jpg/png/webp、生成图等）直接原样返回（短路）；解析异常也原样返回（永不抛错）。
   * MIME 不变——MPO 本就以 image/jpeg 上报，处理后仍是 image/jpeg。
   */
  normalizeImageBuffer(buffer: Buffer, mimeType?: string): Buffer {
    try {
      if (!looksLikeMpo(buffer))
        return buffer
      const normalized = extractMpoFirstJpeg(buffer)
      if (!normalized) {
        console.warn('[FileManager] MPO detected but extraction failed, passthrough')
        return buffer
      }
      console.log(`[FileManager] normalized MPO -> JPEG, ${buffer.length}B -> ${normalized.length}B mime=${normalizeMimeType(mimeType) || 'image/jpeg'}`)
      return normalized
    }
    catch (error) {
      console.warn('[FileManager] image normalize failed, passthrough:', (error as Error).message)
      return buffer
    }
  }

  /**
   * 读取本地文件并上传到 AI Agent 服务端（OSS），返回永久可访问 URL。
   * 失败返回 undefined（吞掉异常，由调用方决定是否回退/报错）。
   */
  private async uploadLocalFileToOss(file: { fileId?: string, fileName?: string, filePath: string, mimeType?: string }): Promise<string | undefined> {
    const filename = file.fileName || path.basename(file.filePath)
    const contentType = normalizeMimeType(file.mimeType) || extToMime(file.filePath) || 'application/octet-stream'
    const buffer = await fs.promises.readFile(file.filePath)
    const blob = new Blob([new Uint8Array(buffer)], { type: contentType })
    const result = await aiAgentFilesApi.upload(blob, filename)
    // V2 接口返回的 url 直接为可永久访问的 OSS URL
    const ossUrl = result.url
    if (typeof ossUrl !== 'string' || !ossUrl)
      throw new Error('File upload response did not include url')
    return ossUrl
  }

  /** 带进程内并发去重的 OSS 上传：同一文件并发调用复用同一 Promise；失败返回 undefined */
  private uploadToOss(file: { fileId?: string, fileName?: string, filePath: string, mimeType?: string }): Promise<string | undefined> {
    const key = file.fileId || path.resolve(file.filePath)
    const existing = uploadTasks.get(key)
    if (existing)
      return existing

    const task = this.uploadLocalFileToOss(file)
      .catch((error) => {
        console.error('File server upload failed:', error)
        return undefined
      })
      .then((remoteUrl) => {
        if (!remoteUrl)
          uploadTasks.delete(key)
        return remoteUrl
      })

    uploadTasks.set(key, task)
    return task
  }

  /**
   * 用内存 buffer 直接上传到 OSS（不读磁盘，避免与本地写入竞态），返回后端 file_id + 永久 URL。
   * 失败返回 undefined（吞异常，由调用方决定降级）。
   */
  async uploadBufferToOss(buffer: Buffer, fileName: string, mimeType?: string): Promise<{ url: string, remoteFileId?: string } | undefined> {
    try {
      const contentType = normalizeMimeType(mimeType) || extToMime(fileName) || 'application/octet-stream'
      const blob = new Blob([new Uint8Array(buffer)], { type: contentType })
      const result = await aiAgentFilesApi.upload(blob, fileName)
      const url = result.url
      if (typeof url !== 'string' || !url)
        throw new Error('File upload response did not include url')
      return { url, remoteFileId: result.file_id }
    }
    catch (error) {
      console.error('[FileManager] uploadBufferToOss failed:', error)
      return undefined
    }
  }

  /**
   * 保存一份内容并入库，返回新建的文件记录。
   * 相同 hash 已存在且本地物理文件仍在时，复用其 local_path 与 oss_url（不写新文件、不重传 OSS）。
   */
  async saveBuffer(input: SaveBufferInput): Promise<FileRecord> {
    this.ensureDir()
    const mimeType = normalizeMimeType(input.mimeType) || 'application/octet-stream'
    // 入口归一化：MPO 等不支持容器在此转成标准 JPEG，确保本地缓存、去重哈希、OSS、
    // 下游图生图/VLM 读图全部基于处理后的字节。非图片/非 MPO 自动短路。
    const buffer = this.normalizeImageBuffer(input.buffer, input.mimeType)
    const hash = this.hashBuffer(buffer)
    const prefix = input.prefix ?? (input.source === 'generated' ? 'generated' : undefined)
    const fileId = this.generateFileId(mimeType, prefix)

    const existing = FileRecordStore.getByHashAny(hash)
    let localPath: string
    let ossUrl: string | null = null

    if (existing?.local_path && fs.existsSync(existing.local_path)) {
      // 物理去重：复用已有本地文件与（如已具备的）OSS URL
      localPath = existing.local_path
      ossUrl = existing.oss_url ?? null
    }
    else {
      localPath = path.join(this.uploadsDir, fileId)
      fs.writeFileSync(localPath, buffer)
    }

    if (!ossUrl && input.ossUrl)
      ossUrl = input.ossUrl
    if (!ossUrl && input.uploadNow) {
      ossUrl = (await this.uploadToOss({ fileId, fileName: input.fileName, filePath: localPath, mimeType })) ?? null
    }

    return FileRecordStore.insert({
      file_id: fileId,
      file_name: input.fileName ?? null,
      local_path: localPath,
      oss_url: ossUrl,
      mime_type: mimeType,
      size: buffer.length,
      hash,
      source: input.source ?? 'upload',
    })
  }

  /**
   * 保存一份内容并入库，同时拿到并持久化后端 OSS file_id（脚本同步场景专用）。
   * **串行 + 全有或全无**：先上传 OSS，成功后才本地写盘 + 入库（直接带上 oss_url 与
   * remote_file_id）。OSS 失败或返回空 → 直接抛错，不触碰本地，无需回滚。本地写盘/入库
   * 失败 → 抛错（此时 OSS 已上传，但本地无条目，可由后续重试或人工补登记）。
   * 不做 hash 去重（脚本每次内容不同且需明确上传换取后端 file_id）。
   */
  async saveBufferWithRemote(input: SaveBufferInput): Promise<FileRecord> {
    this.ensureDir()
    const mimeType = normalizeMimeType(input.mimeType) || 'application/octet-stream'
    const buffer = this.normalizeImageBuffer(input.buffer, input.mimeType)
    const hash = this.hashBuffer(buffer)
    const prefix = input.prefix ?? (input.source === 'generated' ? 'generated' : undefined)
    const fileId = this.generateFileId(mimeType, prefix)
    const fileName = input.fileName ?? fileId

    // 1. 先上传 OSS，拿后端 file_id + url。失败直接抛出，不落本地。
    const uploadResult = await this.uploadBufferToOss(buffer, fileName, mimeType)
    if (!uploadResult || !uploadResult.url || !uploadResult.remoteFileId) {
      throw new Error(
        `saveBufferWithRemote: OSS upload failed or returned empty (url=${uploadResult?.url ?? '(空)'}, remoteFileId=${uploadResult?.remoteFileId ?? '(空)'})`,
      )
    }
    const { url, remoteFileId } = uploadResult

    // 2. OSS 成功后，本地写盘 + 入库（直接带上 oss_url / remote_file_id）。
    const localPath = path.join(this.uploadsDir, fileId)
    await fs.promises.writeFile(localPath, buffer)
    return FileRecordStore.insert({
      file_id: fileId,
      file_name: input.fileName ?? null,
      local_path: localPath,
      oss_url: url,
      remote_file_id: remoteFileId,
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
    if (!fs.existsSync(filePath))
      return null
    const buffer = fs.readFileSync(filePath)
    const mimeType = normalizeMimeType(input.mimeType) || extToMime(input.fileId) || 'application/octet-stream'
    return FileRecordStore.insert({
      file_id: input.fileId,
      file_name: input.fileName ?? input.fileId,
      local_path: filePath,
      oss_url: input.ossUrl ?? null,
      mime_type: mimeType,
      size: buffer.length,
      hash: this.hashBuffer(buffer),
      source: input.source ?? 'upload',
    })
  }

  /** 按 fileId 查记录；DB 未命中但本地存在则补登记（向后兼容历史文件） */
  get(fileId: string): FileRecord | null {
    if (!fileId)
      return null
    const record = FileRecordStore.getByFileId(fileId)
    if (record)
      return record
    if (fs.existsSync(path.join(this.uploadsDir, fileId)))
      return this.registerLocalFile({ fileId })
    return null
  }

  /** 本地物理路径（去重条目指向首次上传的文件，故必须查 DB；未命中回退 uploadsDir/fileId） */
  getLocalPath(fileId: string): string {
    const record = FileRecordStore.getByFileId(fileId)
    return record?.local_path || path.join(this.uploadsDir, fileId)
  }

  exists(fileId: string): boolean {
    const localPath = this.getLocalPath(fileId)
    return Boolean(localPath) && fs.existsSync(localPath)
  }

  readBuffer(fileId: string): Buffer {
    return fs.readFileSync(this.getLocalPath(fileId))
  }

  /** 读为 data URL（base64）。mime 优先取 DB 记录，其次入参提示，再次按扩展名推断 */
  readDataUrl(fileId: string, mimeTypeHint?: string): string {
    const record = FileRecordStore.getByFileId(fileId)
    const mimeType = normalizeMimeType(record?.mime_type || mimeTypeHint) || extToMime(fileId) || 'application/octet-stream'
    const base64 = this.readBuffer(fileId).toString('base64')
    return `data:${mimeType};base64,${base64}`
  }

  /** 文件 MIME（DB 优先，回退按扩展名推断） */
  resolveMimeType(fileId: string, hint?: string): string {
    const record = FileRecordStore.getByFileId(fileId)
    return normalizeMimeType(record?.mime_type || hint) || extToMime(fileId) || 'application/octet-stream'
  }

  /**
   * 确保拿到 OSS URL：DB 命中直接返回；否则按 hash 复用已上传结果；再否则上传本地文件并按 hash 回填。
   * 文件不存在或上传失败返回 undefined。
   */
  async resolveRemoteUrl(fileId: string): Promise<string | undefined> {
    const record = this.get(fileId)
    if (!record)
      return undefined
    if (record.oss_url)
      return record.oss_url

    if (record.hash) {
      const hit = FileRecordStore.getByHashWithOss(record.hash)
      if (hit?.oss_url) {
        FileRecordStore.setOssByHash(record.hash, hit.oss_url)
        return hit.oss_url
      }
    }

    const localPath = record.local_path || path.join(this.uploadsDir, fileId)
    if (!fs.existsSync(localPath))
      return undefined

    const ossUrl = await this.uploadToOss({
      fileId,
      fileName: record.file_name ?? undefined,
      filePath: localPath,
      mimeType: record.mime_type ?? undefined,
    })
    if (ossUrl) {
      if (record.hash)
        FileRecordStore.setOssByHash(record.hash, ossUrl)
      else
        FileRecordStore.setOssById(fileId, ossUrl)
    }
    return ossUrl
  }

  async requireRemoteUrl(fileId: string): Promise<string> {
    const url = await this.resolveRemoteUrl(fileId)
    if (!url)
      throw new Error(`Failed to resolve remote URL for file: ${fileId}`)
    return url
  }

  /**
   * 同步文件寻址（不触发上传）：优先已有 OSS URL，其次本地 `/api/files/{fileId}`，再次 fallbackUrl。
   * 供 search_artifacts / asset → imagePath 等场景统一使用。
   */
  resolveImagePath(fileId?: string | null, options: { fallbackUrl?: string | null } = {}): string {
    if (fileId) {
      const record = FileRecordStore.getByFileId(fileId)
      if (record?.oss_url)
        return record.oss_url
      const localPath = record?.local_path || path.join(this.uploadsDir, fileId)
      if (fs.existsSync(localPath))
        return `/api/files/${fileId}`
    }
    if (options.fallbackUrl)
      return options.fallbackUrl
    return fileId ? `/api/files/${fileId}` : ''
  }

  /**
   * 由 fileId 解析出完整附件信息（fileName / mimeType / size / 本地与远程 URL）。
   * 前端只回传 fileId 时用于补全；DB 未命中则用入参 partial 兜底。
   * 不触发上传：remoteUrl 仅取已落库的 oss_url（需要时调用方再用 resolveRemoteUrl 异步获取）。
   */
  toAttachmentRef(fileId: string, partial: Partial<ResolvedAttachment> = {}): ResolvedAttachment {
    const record = this.get(fileId)
    const hasLocal = this.exists(fileId)
    const mimeType = normalizeMimeType(record?.mime_type || partial.mimeType) || extToMime(fileId) || 'application/octet-stream'
    const remoteUrl = record?.oss_url || partial.remoteUrl || partial.fileUrl || undefined
    const localUrl = hasLocal ? `/api/files/${fileId}` : (partial.localUrl || partial.url)
    return {
      fileId,
      fileName: record?.file_name || partial.fileName || fileId,
      mimeType,
      size: record?.size ?? partial.size,
      url: localUrl || remoteUrl || partial.url,
      localUrl,
      remoteUrl,
      fileUrl: remoteUrl,
    }
  }
}

export const fileManager = new FileManager()
