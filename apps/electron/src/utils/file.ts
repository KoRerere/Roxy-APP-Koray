import { createWriteStream } from 'node:fs'
import { access, cp, mkdir, rename, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileOperations } from '/@/modules/fileOperations'
import { request } from '/@/utils/request'

const ZIP_FILE_PATTERN = /\.zip$/

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
export async function downloadZipFile(
  url: string,
  outputZipPath: string,
  downloadProgress?: (progress: number) => void,
  options?: { signal?: AbortSignal },
) {
  let timer: NodeJS.Timeout
  let rejectDownload: ((error: Error) => void) | undefined

  const response = await request({
    method: 'get',
    url,
    responseType: 'stream',
    signal: options?.signal,
    // electronAdapter 的 timeout 是请求开始即计时的总截止，会中断大文件下载；
    // 这里关闭它，改由下方 30s「不活动」看门狗兜底
    timeout: 0,
    onDownloadProgress: (progressEvent) => {
      clearTimeout(timer)
      const totalLength = progressEvent.total
      const progress = Math.round((progressEvent.loaded * 100) / totalLength!)
      // console.log(`Download progress: ${progress}%`)
      downloadProgress?.(progress)
      if (progress < 100) {
        timer = setTimeout(() => {
          rejectDownload?.(new Error('download timeout'))
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

  return new Promise<void>((resolve, reject) => {
    let settled = false

    const finish = (callback: (reason?: any) => void, reason?: any) => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timer)
      options?.signal?.removeEventListener('abort', handleAbort)
      writer.off('finish', handleFinish)
      writer.off('error', handleError)
      response.data.off('error', handleError)
      callback(reason)
    }

    async function cleanupOutput() {
      await rm(outputZipPath, { force: true }).catch(() => {})
    }

    function handleFinish() {
      finish(() => resolve())
    }

    function handleReject(error: any) {
      console.error('downloadZipFile writer error', error)
      cleanupOutput().finally(() => {
        finish(reject, error)
      })
    }

    rejectDownload = handleReject

    function handleError(error: any) {
      handleReject(error)
    }

    function handleAbort() {
      const abortError = options?.signal?.reason instanceof Error
        ? options.signal.reason
        : new Error('download aborted')

      response.data.destroy(abortError)
      writer.destroy(abortError)
      handleReject(abortError)
    }

    writer.on('finish', handleFinish)
    writer.on('error', handleError)
    response.data.on('error', handleError)

    if (options?.signal?.aborted) {
      handleAbort()
      return
    }

    options?.signal?.addEventListener('abort', handleAbort, { once: true })
    response.data.pipe(writer)
  })
}

/**
 * https://github.com/thejoshwolfe/yauzl?tab=readme-ov-file#no-streaming-unzip-api
 * 解压缩文件
 *
 * @param zipFilePath zip 文件路径
 * @param outputDir 输出目录，默认为 zip 文件所在目录
 */
export async function unzipFile(zipFilePath: string, outputDir?: string, options?: { signal?: AbortSignal }) {
  outputDir ||= zipFilePath.replace(ZIP_FILE_PATTERN, '')
  return fileOperations.executeTask('decompress', { src: zipFilePath, dest: outputDir }, { signal: options?.signal })
}

export async function getFolderSize(folderPath: string) {
  const isFileExists = await fileExists(folderPath)
  if (!isFileExists) {
    return 0
  }
  // CommonJS 兼容处理
  const _getFolderSize = (await import('get-folder-size')).default

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
  }
  catch (e: any) {
    console.error('moveDir error', e)
    if (e.code !== 'EXDEV') {
      throw e
    }
    // 跨盘：只能 copy + delete
    await cp(src, dest, { recursive: true })
    await rm(src, { recursive: true })
  }
}
