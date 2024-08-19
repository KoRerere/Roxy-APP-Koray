import { access, mkdir, rm } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { dirname } from 'node:path'
import unzipper from 'unzipper'
import axios from 'axios'

/** 文件或目录是否存在 */
export async function fileExists(filePath: string) {
  try {
    await access(filePath)
    return true
  }
  catch {
    return false
  }
}

/** 流式下载 zip 文件 */
export async function downloadZipFile(url: string, outputZipPath: string) {
  const { promise, resolve, reject } = Promise.withResolvers()
  const response = await axios({
    method: 'get',
    url,
    responseType: 'stream',
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

/** 解压缩文件 */
export async function unzipFile(zipFilePath: string, outputDir: string) {
  const directory = await unzipper.Open.file(zipFilePath)
  await directory.extract({ path: outputDir })
}
