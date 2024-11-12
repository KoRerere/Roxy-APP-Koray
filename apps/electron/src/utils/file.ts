import axios from 'axios'
import { createReadStream, createWriteStream } from 'node:fs'
import { access, mkdir, rm, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileOperations } from '/@/modules/fileOperations'

/**
 * 文件或目录是否存在
 *
 * @param filePath 文件或目录路径
 * @param create 目录不存在时是否创建
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
      // console.log(`Download progress: ${progress}%`)
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
  await fileOperations.executeTask('decompress', { src: zipFilePath, dest: outputDir })
}
