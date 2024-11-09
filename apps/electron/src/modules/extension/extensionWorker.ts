import AdmZip from 'adm-zip'
import iconv from 'iconv-lite'
import path from 'node:path'
import { isMainThread, parentPort } from 'node:worker_threads'

if (!isMainThread && parentPort) {
  parentPort.on('message', (message) => {
    console.log('pluginWorker', message)
    const { type, data } = message

    if (type === 'calculatePluginSize') {
      const size = calculatePluginSize(data)
      parentPort?.postMessage({ type, data: size })
    }
    else if (type === 'extractPlugin') {
      const { pluginDir, destDir } = data
      try {
        const targetDir = extractPlugin(pluginDir, destDir)
        parentPort?.postMessage({ type, data: targetDir })
      }
      catch (error) {
        parentPort?.postMessage({ type: 'error', data: error })
      }
    }
  })
}

/** 解压文件 */
function extractPlugin(pluginDir: string, destDir: string) {
  const zip = new AdmZip(pluginDir)
  const zipEntries = zip.getEntries()

  const extractDir = path.join(destDir, path.parse(pluginDir).name)
  console.log('extractDir', extractDir)

  zipEntries.forEach((entry) => {
    entry.entryName = iconv.decode(entry.rawEntryName, 'gbk')
  })
  zip.extractAllTo(extractDir, true)
  return extractDir
}

/** 获取插件压缩后的大小 */
function calculatePluginSize(pluginDir: string) {
  const zip = new AdmZip()
  zip.addLocalFolder(pluginDir)
  return zip.toBuffer().length
}
