import archiver from 'archiver'
import axios from 'axios'
import compressing from 'compressing'
import { createReadStream, createWriteStream } from 'node:fs'
import { access, mkdir, rm, stat } from 'node:fs/promises'
import { dirname } from 'node:path'

/**
 * 文件或目录是否存在
 *
 * @param filePath 文件或目录路径
 * @param create 不存在时是否创建
 */
export async function fileExists(filePath: string, create = false) {
  try {
    await access(filePath)
    return true
  }
  catch {
    if (create) {
      try {
        await mkdir(filePath, { recursive: true })
        return true
      }
      catch (error) {
        console.log('mkdir error', error)
        return false
      }
    }
    return false
  }
}

/**
 * 流式下载 zip 文件
 */
export async function downloadZipFile(url: string, outputZipPath: string, downloadProgress?: (progress: number) => void) {
  const { promise, resolve, reject } = Promise.withResolvers()
  const response = await axios({
    method: 'get',
    url,
    responseType: 'stream',
    onDownloadProgress: (progressEvent) => {
      const totalLength = progressEvent.total
      const progress = Math.round((progressEvent.loaded * 100) / totalLength!)
      console.log(`Download progress: ${progress}%`)
      downloadProgress?.(progress)
    },
  })

  const isFileExists = await fileExists(outputZipPath)
  if (isFileExists) {
    await rm(outputZipPath)
  }

  const isDirExists = await fileExists(dirname(outputZipPath))

  if (!isDirExists) {
    await mkdir(dirname(outputZipPath), { recursive: true })
  }

  const writer = createWriteStream(outputZipPath)

  response.data.pipe(writer)

  writer.on('finish', resolve)
  writer.on('error', reject)

  return promise
}

/**
 * https://github.com/thejoshwolfe/yauzl?tab=readme-ov-file#no-streaming-unzip-api
 * 解压缩文件
 *
 * @param zipFilePath zip 文件路径
 * @param outputDir 输出目录，默认为 zip 文件所在目录
 */
export async function unzipFile(zipFilePath: string, outputDir?: string) {
  outputDir ||= zipFilePath.replace(/\.zip$/, '')
  await compressing.zip.uncompress(zipFilePath, outputDir)
}

/** 压缩给定的文件或目录 */
export async function filesToZip(files: { path: string, destPath: string }[], outputPath: string) {
  console.log('files', files)
  console.log('outputPath', outputPath)
  const { promise, resolve, reject } = Promise.withResolvers()
  // create a file to stream archive data to.
  await fileExists(dirname(outputPath), true)
  const output = createWriteStream(outputPath)
  const archive = archiver('zip', {
    zlib: { level: 9 }, // Sets the compression level.
  })

  // listen for all archive data to be written
  // 'close' event is fired only when a file descriptor is involved
  output.on('close', () => {
    console.log(`${archive.pointer()} total bytes`)
    console.log('archiver has been finalized and the output file descriptor has closed.')
    resolve(archive.pointer())
  })

  // This event is fired when the data source is drained no matter what was the data source.
  // It is not part of this library but rather from the NodeJS Stream API.
  // @see: https://nodejs.org/api/stream.html#stream_event_end
  output.on('end', () => {
    resolve(true)
  })

  // good practice to catch warnings (ie stat failures and other non-blocking errors)
  archive.on('warning', (err) => {
    if (err.code === 'ENOENT') {
      // log warning
    }
    else {
      // throw error
      reject(err)
    }
  })

  // good practice to catch this error explicitly
  archive.on('error', (err) => {
    // console.log('archive error', err)
    reject(err)
  })

  // pipe archive data to the file
  archive.pipe(output)

  const promiseArr = files.map(async (item) => {
    const fileInfo = await stat(item.path)
    if (fileInfo.isDirectory()) {
      archive.directory(item.path, item.destPath || false)
    }
    else if (fileInfo.isFile()) {
      archive.append(createReadStream(item.path), { name: item.destPath })
    }
  })

  const res = await Promise.allSettled(promiseArr)
  console.log('结果', res)
  archive.finalize()

  return promise
}
