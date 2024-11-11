import AdmZip from 'adm-zip'
import iconv from 'iconv-lite'
import { parentPort } from 'node:worker_threads'
import type { TaskMap, TaskQueueItem } from './taskTypes'

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
          await compressFile(payload.src, payload.dest)
          sendSuccess('文件压缩成功')
          break
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

}

/** 解压文件 */
function decompressFile(source: string, dest: string) {
  const zip = new AdmZip(source)
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
