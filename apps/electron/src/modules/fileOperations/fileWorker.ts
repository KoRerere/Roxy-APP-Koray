
import AdmZip from 'adm-zip'
import { stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { TaskMap, TaskQueueItem, ZipPayload } from './taskTypes'
import si from 'systeminformation'
import { createHash } from 'node:crypto'

process.parentPort?.on('message', async (e) => {
  const { task, payload, taskId } = e.data as { task: keyof TaskMap, taskId, payload: any }

  const sendSuccess = (data: any) => process.parentPort.postMessage({ taskId, status: 'success', data })
  const sendError = (error: Error) => process.parentPort.postMessage({ taskId, status: 'error', error: error.message })

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
          const { src, dest, filters } = payload as TaskQueueItem<typeof task>['payload']
          sendSuccess(decompressFile(src, dest, filters))
          break
        }
      case 'getCompressedSize':
        {
          const dest = payload as TaskQueueItem<typeof task>['payload']
          const size = getCompressedSize(dest)
          sendSuccess(size)
          break
        }
      case 'getDeviceInfo':
        {
          sendSuccess(await getDeviceInfo())
          break
        }
      default:
        throw new Error('unknown task type')
    }
  }
  catch (error) {
    sendError(error as Error)
  }
})


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
      zip.addLocalFile(file.src, dirname(file.dest))
    }
  })
  await Promise.allSettled(promiseArr)
  zip.writeZip(dest)
  return dest
}

/** 解压文件 */
function decompressFile(src: string, dest: string, filters?: string[]) {
  const zip = new AdmZip(src)
  const zipEntries = zip.getEntries()
  zipEntries.forEach((entry) => {
    // 过滤不需要的文件
    if (filters?.length && !filters.some(filter => entry.entryName.includes(filter))) {
      zip.deleteFile(entry)
      return
    }
    const decoder = new TextDecoder('gbk');    // 创建 GBK 解码器
    entry.entryName = decoder.decode(entry.rawEntryName);
    // entry.entryName = iconv.decode(entry.rawEntryName, 'gbk')
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


/** 获取设备信息 */
const getDeviceInfo = async () => {
  console.time('get device info time')
  const queue = [si.uuid(), si.diskLayout()] as const
  const [uuid, disk,] = await Promise.all(queue)

  console.debug('sys.uuid', uuid)
  console.debug('disk[0]?.serialNum', disk[0]?.serialNum)

  return {
    ...uuid,
    serialNum: disk[0]?.serialNum,
  };
}
