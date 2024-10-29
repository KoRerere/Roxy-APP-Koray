import axios from 'axios'
import { createWriteStream } from 'node:fs'
import { access, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { API } from '/@/api'
import { appConfig, osConfig } from '/@/constants'
import { ipcMain } from '/@/modules/ipc'
import { fileExists, isMac } from '/@/utils'

/** 发送启动消息 */
function sendLaunchMessage(message: string) {
  ipcMain.send('app:launch-message', message)
}

export async function checkResource() {
  const { promise, resolve } = Promise.withResolvers()
  const startCheckTime = Date.now()
  console.log('checkResource start')
  sendLaunchMessage($t('正在检查资源是否需要更新...'))
  try {
    const { code, data } = await API.base.userGetAppUpgradeCreate(osConfig)

    if (code === 0) {
      const webDomain = data.webDomain
      // 检测更新 luminet
      await checkLuminetBin(webDomain)
    }
  }
  catch (error) {
    console.error('checkResource error', error)
  }
  console.log('checkResource end')
  if (Date.now() - startCheckTime < 1500) {
    setTimeout(() => {
      sendLaunchMessage($t('检查完成'))
      resolve(true)
    }, 1800)
  }
  else {
    sendLaunchMessage($t('检查完成'))
    resolve(true)
  }
  return promise
}

/** 检查 luminet 是否存在 */
async function checkLuminetBin(webDomain: string) {
  const { promise, resolve } = Promise.withResolvers()
  // 获取文件所在的目录路径
  const luminetBinDir = dirname(appConfig.luminetBinPath)
  await fileExists(luminetBinDir, true)
  const luminetBinExist = await fileExists(appConfig.luminetBinPath)

  const platform = isMac ? 'macos' : 'windows'
  let arch = ''
  if (isMac) {
    arch = process.arch === 'x64' ? 'intel' : 'apple'
  }
  else {
    arch = process.arch === 'x64' ? 'x64' : 'x86'
  }
  const binFile = `luminet${isMac ? '' : '.exe'}`

  // luminet 执行文件下载地址
  const downloadUrl = `${webDomain}/public/static/luminet/${platform}/${arch}/${binFile}`
  // luminet 版本文件下载地址
  const versionUrl = `${webDomain}/public/static/luminet/version`
  // luminet 版本文件本地路径
  const localVersionFilePath = join(luminetBinDir, 'version')
  // luminet 版本文件本地版本
  const localVersion = await access(localVersionFilePath)
    .then(async () => (await readFile(localVersionFilePath)).toString())
    .catch(() => '')

  // 下载 luminet 版本文件
  const remoteVersion = await axios({
    url: versionUrl,
    method: 'get',
    timeout: 5000,
  }).then(async (response) => {
    const version = response.data.toString()

    writeFile(localVersionFilePath, version)
    console.log('luminet version', version)
    return version
  })

  if (!luminetBinExist || remoteVersion !== localVersion) {
    console.log('正在下载 luminet')
    // 下载 luminet
    const response = await axios({
      url: downloadUrl,
      method: 'get',
      responseType: 'stream',
      onDownloadProgress: (progressEvent) => {
        const total = progressEvent.total || 0
        const current = progressEvent.loaded
        const percentage = Math.round((current / total) * 100)
        console.log(`Download progress: ${percentage}%`)
        sendLaunchMessage(`Downloading luminet ${percentage}%`)
      },
    })
    const writer = createWriteStream(appConfig.luminetBinPath)

    response.data.pipe(writer)

    writer.on('finish', () => {
      writer.close()
      sendLaunchMessage($t('luminet 下载完成'))
      resolve(true)
    })
  }
  else {
    resolve(true)
  }

  return promise
}
