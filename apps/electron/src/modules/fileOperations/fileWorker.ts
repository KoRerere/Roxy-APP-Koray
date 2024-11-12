import AdmZip from 'adm-zip'
import iconv from 'iconv-lite'
import { stat } from 'node:fs/promises'
import { parentPort } from 'node:worker_threads'
import type { TaskMap, TaskQueueItem, ZipPayload } from './taskTypes'

// 确保 parentPort 存在
if (parentPort) {
  // 监听来自主线程的消息
  parentPort.on('message', async (message: { task: keyof TaskMap, taskId, payload: any }) => {
    const { task, payload, taskId } = message

    const sendSuccess = (data: any) => parentPort?.postMessage({ taskId, status: 'success', data })
    const sendError = (error: Error) => parentPort?.postMessage({ taskId, status: 'error', error: error.message })

    try {
      switch (task) {
        case 'compress':
          sendSuccess(compressFile(payload.src, payload.dest))
          break
        case 'compressFiles':
          {
            const { files, dest } = payload as TaskQueueItem<typeof task>['payload']
            sendSuccess(await compressFiles(files, dest))
            break
          }
        case 'decompress':
          {
            const { src, dest } = payload as TaskQueueItem<typeof task>['payload']
            sendSuccess(decompressFile(src, dest))
            break
          }
        case 'getCompressedSize':
          {
            const dest = payload as TaskQueueItem<typeof task>['payload']
            const size = getCompressedSize(dest)
            sendSuccess(size)
            break
          }
        default:
          throw new Error('未知任务类型')
      }
    }
    catch (error) {
      sendError(error as Error)
    }
  })
}

/**
 * 压缩文件
 */
function compressFile(src: string, dest: string) {
  const zip = new AdmZip()
  zip.addLocalFolder(src)
  zip.writeZip(dest)
  return dest
}

/** 压缩指定的文件 */
async function compressFiles(files: ZipPayload[], dest: string) {
  const zip = new AdmZip()
  const promiseArr = files.map(async (file) => {
    const fileInfo = await stat(file.src)
    if (fileInfo.isDirectory()) {
      zip.addLocalFolder(file.src, file.dest)
    }
    else if (fileInfo.isFile()) {
      zip.addLocalFile(file.src, file.dest)
    }
  })
  await Promise.allSettled(promiseArr)
  zip.writeZip(dest)
  return dest
}

/** 解压文件 */
function decompressFile(src: string, dest: string) {
  const zip = new AdmZip(src)
  const zipEntries = zip.getEntries()
  zipEntries.forEach((entry) => {
    entry.entryName = iconv.decode(entry.rawEntryName, 'gbk')
  })
  zip.extractAllTo(dest, true, true)
  return dest
}

/** 获取文件压缩后的大小 */
function getCompressedSize(dest: string) {
  const zip = new AdmZip()
  zip.addLocalFolder(dest)
  return zip.toBuffer().length
}
