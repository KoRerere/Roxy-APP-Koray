import type { Buffer } from 'node:buffer'
import type { Readable } from 'node:stream'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import yauzl from 'yauzl'

/** 目录条目路径以 / 结尾（yauzl 约定） */
const DIR_ENTRY_SUFFIX = /\/$/

export interface UnzipOptions {
  /**
   * 去掉路径前 N 段（例如 zip 根目录只有一层文件夹时可传 1）
   */
  strip?: number
  /**
   * 每个条目解压前调用；返回 false 则跳过该条目
   */
  filter?: (entryName: string, entry: yauzl.Entry) => boolean
}

const defaultOpenOptions: yauzl.OpenOptions = {
  lazyEntries: true,
  strictFileNames: true,
}

function openZip(pathToZip: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(pathToZip, defaultOpenOptions, (err, zipfile) => {
      if (err)
        reject(err)
      else if (!zipfile)
        reject(new Error('yauzl.open 未返回 zipfile'))
      else resolve(zipfile)
    })
  })
}

function openZipFromBuffer(buffer: Buffer): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, defaultOpenOptions, (err, zipfile) => {
      if (err)
        reject(err)
      else if (!zipfile)
        reject(new Error('yauzl.fromBuffer 未返回 zipfile'))
      else resolve(zipfile)
    })
  })
}

function openReadStream(zipfile: yauzl.ZipFile, entry: yauzl.Entry): Promise<Readable> {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, stream) => {
      if (err)
        reject(err)
      else if (!stream)
        reject(new Error('openReadStream 未返回可读流'))
      else resolve(stream)
    })
  })
}

function stripPathComponents(fileName: string, strip: number): string {
  if (strip <= 0)
    return fileName
  const parts = fileName.split('/').filter(p => p.length > 0)
  if (parts.length <= strip)
    return ''
  return `${parts.slice(strip).join('/')}${fileName.endsWith('/') ? '/' : ''}`
}

/**
 * 确保解压目标在 destDir 内，防止 Zip Slip
 */
function assertSafeExtractPath(destDir: string, entryRelativePath: string): string {
  const resolvedDest = path.resolve(destDir)
  const joined = path.join(resolvedDest, entryRelativePath)
  const resolved = path.resolve(joined)
  const prefix = resolvedDest.endsWith(path.sep) ? resolvedDest : `${resolvedDest}${path.sep}`
  if (resolved !== resolvedDest && !resolved.startsWith(prefix)) {
    throw new Error(`非法路径：条目 "${entryRelativePath}" 会解压到目标目录外`)
  }
  return resolved
}

async function extractOneEntry(
  zipfile: yauzl.ZipFile,
  destDir: string,
  entry: yauzl.Entry,
  options: UnzipOptions | undefined,
): Promise<void> {
  let name = entry.fileName
  if (options?.strip != null && options.strip > 0) {
    name = stripPathComponents(name, options.strip)
    if (!name || name === '/')
      return
  }

  if (options?.filter && !options.filter(name, entry))
    return

  if (entry.isEncrypted()) {
    throw new Error(`不支持加密条目: ${entry.fileName}`)
  }

  const isDir = DIR_ENTRY_SUFFIX.test(name)
  const target = assertSafeExtractPath(destDir, name)

  if (isDir) {
    await fs.mkdir(target, { recursive: true })
    return
  }

  await fs.mkdir(path.dirname(target), { recursive: true })
  const readStream = await openReadStream(zipfile, entry)
  await pipeline(readStream, createWriteStream(target))
}

function runUnzip(
  zipfile: yauzl.ZipFile,
  destDir: string,
  options: UnzipOptions | undefined,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error) => {
      zipfile.close()
      reject(err)
    }

    zipfile.once('error', onError)
    zipfile.on('end', () => {
      zipfile.close()
      resolve()
    })

    zipfile.on('entry', (entry) => {
      void (async () => {
        try {
          await extractOneEntry(zipfile, destDir, entry, options)
        }
        catch (err) {
          onError(err instanceof Error ? err : new Error(String(err)))
          return
        }
        zipfile.readEntry()
      })()
    })

    zipfile.readEntry()
  })
}

/**
 * 将 zip 文件解压到目录（自动创建目录；条目顺序处理，避免内存与 fd 压力）
 */
export async function unzipToDirectory(
  zipPath: string,
  destDir: string,
  options?: UnzipOptions,
): Promise<void> {
  await fs.mkdir(destDir, { recursive: true })
  const zipfile = await openZip(zipPath)
  await runUnzip(zipfile, destDir, options)
}

/**
 * 将内存中的 zip 解压到目录
 */
export async function unzipBufferToDirectory(
  buffer: Buffer,
  destDir: string,
  options?: UnzipOptions,
): Promise<void> {
  await fs.mkdir(destDir, { recursive: true })
  const zipfile = await openZipFromBuffer(buffer)
  await runUnzip(zipfile, destDir, options)
}

/**
 * 列出 zip 内所有条目路径（不解压）
 */
export async function listZipEntries(zipPath: string): Promise<string[]> {
  const zipfile = await openZip(zipPath)
  const names: string[] = []

  await new Promise<void>((resolve, reject) => {
    zipfile.once('error', reject)
    zipfile.on('end', () => {
      zipfile.close()
      resolve()
    })
    zipfile.on('entry', (entry) => {
      names.push(entry.fileName)
      zipfile.readEntry()
    })
    zipfile.readEntry()
  })

  return names
}
