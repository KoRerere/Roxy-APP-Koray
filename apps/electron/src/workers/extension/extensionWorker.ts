import { isMainThread, parentPort } from 'node:worker_threads'
import path from 'node:path'
import AdmZip from 'adm-zip'
import iconv from 'iconv-lite'

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
function extractPlugin(pluginDir, destDir) {
  const zip = new AdmZip(pluginDir)
  const zipEntries = zip.getEntries()

  const hasManifest = zipEntries.some(entry => entry.entryName === 'manifest.json')

  zipEntries.forEach((entry) => {
    entry.entryName = iconv.decode(entry.rawEntryName, 'gbk')
  })
  const targetDir = hasManifest ? `${destDir}/${path.parse(pluginDir).name}` : destDir
  zip.extractAllTo(targetDir, true)
  return targetDir
}

/** 获取插件压缩后的大小 */
function calculatePluginSize(pluginDir) {
  const zip = new AdmZip()
  zip.addLocalFolder(pluginDir)
  return zip.toBuffer().length
}
