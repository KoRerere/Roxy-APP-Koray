import type { Buffer } from 'node:buffer'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { buffer as bufferFromReadable } from 'node:stream/consumers'
import { pipeline } from 'node:stream/promises'
import { ZipFile } from 'yazl'

/**
 * 说明：yauzl 仅负责读取 zip；写入 zip 需使用同作者配套的 yazl（本模块）。
 * @see https://github.com/thejoshwolfe/yazl
 */

export interface ZipAddEntryOptions {
  mtime?: Date
  mode?: number
  compress?: boolean
  compressionLevel?: number
}

export interface ZipDirectoryOptions extends ZipAddEntryOptions {
  /**
   * 为 zip 内所有路径加此前缀（使用 `/` 分隔）
   */
  pathPrefix?: string
  /**
   * 在 zip 内多包一层根目录（目录名为 sourceDir 的 basename）
   */
  includeRootFolder?: boolean
  /**
   * 返回 false 则跳过该文件（目录条目不受 filter 影响，仍会为非空目录下的文件创建路径）
   */
  filter?: (absolutePath: string, zipPath: string) => boolean
}

type CollectedZipEntry
  = | { kind: 'file', abs: string, zip: string }
    | { kind: 'dir', zip: string }

function toPosix(relativePath: string): string {
  return relativePath.split(path.sep).join('/')
}

function normalizeZipEntryPath(zipPath: string): string {
  const normalized = zipPath.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!normalized || /^[A-Z]:/i.test(normalized)) {
    throw new Error(`非法 zip 路径: ${zipPath}`)
  }

  const segments = normalized
    .split('/')
    .filter(segment => segment.length > 0 && segment !== '.')

  if (segments.length === 0 || segments.includes('..')) {
    throw new Error(`非法 zip 路径: ${zipPath}`)
  }

  return segments.join('/')
}

function withZipPrefix(zipPath: string, prefix: string | undefined): string {
  if (!prefix)
    return zipPath
  return zipPath ? `${prefix}/${zipPath}` : prefix
}

async function collectDirectoryEntries(
  rootDir: string,
  options: ZipDirectoryOptions | undefined,
): Promise<CollectedZipEntry[]> {
  const rootResolved = path.resolve(rootDir)
  const basePrefix = options?.includeRootFolder ? path.basename(rootResolved) : ''
  const extraPrefix = options?.pathPrefix

  const items: CollectedZipEntry[] = []

  async function walk(currentDir: string): Promise<void> {
    let dirents
    try {
      dirents = await fs.readdir(currentDir, { withFileTypes: true })
    }
    catch {
      throw new Error(`无法读取目录: ${currentDir}`)
    }

    const relDir = path.relative(rootResolved, currentDir)
    const dirZipRaw = relDir === '' ? '' : toPosix(relDir)

    if (dirents.length === 0 && currentDir !== rootResolved) {
      const zipped = withZipPrefix(dirZipRaw, basePrefix)
      const zipPath = withZipPrefix(zipped, extraPrefix)
      items.push({ kind: 'dir', zip: zipPath })
      return
    }

    for (const ent of dirents) {
      const abs = path.join(currentDir, ent.name)
      if (ent.isDirectory()) {
        await walk(abs)
      }
      else if (ent.isFile()) {
        const relFile = path.relative(rootResolved, abs)
        const zipRaw = toPosix(relFile)
        const zipped = withZipPrefix(zipRaw, basePrefix)
        const zipPath = withZipPrefix(zipped, extraPrefix)
        if (options?.filter && !options.filter(abs, zipPath))
          continue
        items.push({ kind: 'file', abs, zip: zipPath })
      }
    }
  }

  await walk(rootResolved)

  items.sort((a, b) => {
    if (a.kind !== b.kind)
      return a.kind === 'dir' ? -1 : 1
    return a.zip.localeCompare(b.zip)
  })

  return items
}

async function collectListEntries(files: ZipFileEntry[]): Promise<CollectedZipEntry[]> {
  const items: CollectedZipEntry[] = []

  for (const file of files) {
    const zipRoot = normalizeZipEntryPath(file.zipPath)

    let stats
    try {
      stats = await fs.stat(file.filePath)
    }
    catch (error: any) {
      if (error?.code === 'ENOENT') {
        continue
      }
      throw error
    }

    if (stats.isDirectory()) {
      const dirEntries = await collectDirectoryEntries(file.filePath, { pathPrefix: zipRoot })
      if (dirEntries.length === 0) {
        items.push({ kind: 'dir', zip: zipRoot })
      }
      else {
        const normalizedEntries: CollectedZipEntry[] = dirEntries.map(entry => entry.kind === 'dir'
          ? { kind: 'dir' as const, zip: normalizeZipEntryPath(entry.zip) }
          : { kind: 'file' as const, abs: entry.abs, zip: normalizeZipEntryPath(entry.zip) })
        items.push(...normalizedEntries)
      }
      continue
    }

    if (stats.isFile()) {
      items.push({ kind: 'file', abs: file.filePath, zip: zipRoot })
    }
  }

  items.sort((a, b) => {
    if (a.kind !== b.kind)
      return a.kind === 'dir' ? -1 : 1
    return a.zip.localeCompare(b.zip)
  })

  return items
}

function attachZipError(zipfile: ZipFile, reject: (e: Error) => void): void {
  zipfile.on('error', reject)
}

/**
 * 将目录打包为 zip 文件（含空子目录条目；路径使用 `/`，且为相对路径，避免 yazl 校验失败）
 */
export async function zipDirectoryToFile(
  sourceDir: string,
  zipPath: string,
  options?: ZipDirectoryOptions,
): Promise<void> {
  const entries = await collectDirectoryEntries(sourceDir, options)
  const zipfile = new ZipFile()
  const addOpts: ZipAddEntryOptions | undefined = options
    ? {
        mtime: options.mtime,
        mode: options.mode,
        compress: options.compress,
        compressionLevel: options.compressionLevel,
      }
    : undefined

  for (const item of entries) {
    const normalizedZipPath = normalizeZipEntryPath(item.zip)
    if (item.kind === 'dir')
      zipfile.addEmptyDirectory(normalizedZipPath, addOpts)
    else
      zipfile.addFile(item.abs, normalizedZipPath, addOpts)
  }

  await finalizeZipToFile(zipfile, zipPath)
}

export interface ZipFileEntry {
  /** 磁盘上的绝对路径或可读路径，可为文件或目录 */
  filePath: string
  /** zip 内路径（允许历史调用传入前导 `/`，写入前会规范化为相对路径） */
  zipPath: string
}

/**
 * 将指定文件/目录列表打入 zip。
 * 目录会被递归展开，前导 `/` 会在写入前被清理成相对路径。
 */
export async function zipFileListToFile(
  files: ZipFileEntry[],
  zipPath: string,
  options?: ZipAddEntryOptions,
): Promise<void> {
  const entries = await collectListEntries(files)
  const zipfile = new ZipFile()
  for (const entry of entries) {
    if (entry.kind === 'dir')
      zipfile.addEmptyDirectory(entry.zip, options)
    else
      zipfile.addFile(entry.abs, entry.zip, options)
  }

  await finalizeZipToFile(zipfile, zipPath)
}

export interface ZipBufferEntry {
  /** zip 内路径 */
  path: string
  data: Buffer
}

/**
 * 将多段内存数据打入 zip，返回完整 zip 二进制
 */
export async function zipBuffersToBuffer(
  files: ZipBufferEntry[],
  options?: ZipAddEntryOptions,
): Promise<Buffer> {
  const zipfile = new ZipFile()
  for (const f of files)
    zipfile.addBuffer(f.data, normalizeZipEntryPath(f.path), options)

  return finalizeZipToBuffer(zipfile)
}

async function finalizeZipToFile(zipfile: ZipFile, zipPath: string): Promise<void> {
  await fs.mkdir(path.dirname(path.resolve(zipPath)), { recursive: true })
  await new Promise<void>((resolve, reject) => {
    attachZipError(zipfile, reject)
    const done = pipeline(zipfile.outputStream, createWriteStream(zipPath))
    zipfile.end()
    done.then(() => resolve()).catch(reject)
  })
}

async function finalizeZipToBuffer(zipfile: ZipFile): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    attachZipError(zipfile, reject)
    const done = bufferFromReadable(zipfile.outputStream)
    zipfile.end()
    done.then(resolve).catch(reject)
  })
}
