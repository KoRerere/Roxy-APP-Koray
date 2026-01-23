import axios from 'axios'
import { createReadStream, createWriteStream } from 'node:fs'
import { access, cp, mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileOperations } from '/@/modules/fileOperations'

/**
 * 文件或目录是否存在
 *
 * @param filePath 文件或目录路径
 * @param create 目录不存在时是否创建
 * @param rebuild 目录存在时是否重新创建
 */
export async function fileExists(filePath: string, create = false, rebuild = false) {
  try {
    await access(filePath)
    if (rebuild) {
      await rm(filePath, { recursive: true })
      await mkdir(filePath, { recursive: true })
    }
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
  let timer: NodeJS.Timeout

  const handleError = (error) => {
    console.error('downloadZipFile writer error', error)
    reject(error)
    writer.close()
    response.data.destroy()
  }

  const response = await axios({
    method: 'get',
    url,
    responseType: 'stream',
    onDownloadProgress: (progressEvent) => {
      clearTimeout(timer)
      const totalLength = progressEvent.total
      const progress = Math.round((progressEvent.loaded * 100) / totalLength!)
      // console.log(`Download progress: ${progress}%`)
      downloadProgress?.(progress)
      if (progress < 100) {
        timer = setTimeout(() => {
          handleError(new Error('download timeout'))
        }, 30000)
      }
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
  writer.on('error', handleError)

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
  return fileOperations.executeTask('decompress', { src: zipFilePath, dest: outputDir })
}

export async function getFolderSize(folderPath: string) {
  const isFileExists = await fileExists(folderPath)
  if (!isFileExists) {
    return 0
  }
  // CommonJS 兼容处理
  const _getFolderSize = (await import("get-folder-size")).default;

  return _getFolderSize.loose(folderPath)
}

/**
 * 移动目录
 *
 * 如果源目录和目标目录在同一分区，则直接使用 rename 移动
 * 如果源目录和目标目录不在同一分区，则先 copy 再 delete
 * @param src 源目录
 * @param dest 目标目录
 */
export async function moveDir(src: string, dest: string) {
  try {
    await rename(src, dest) // 同分区：几乎瞬间
  } catch (e: any) {
    console.error('moveDir error', e)
    if (e.code !== 'EXDEV') {
      throw e
    }
    // 跨盘：只能 copy + delete
    await cp(src, dest, { recursive: true })
    await rm(src, { recursive: true })
  }
}
