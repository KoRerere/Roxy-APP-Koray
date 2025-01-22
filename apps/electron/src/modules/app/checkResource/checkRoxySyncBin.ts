import axios from 'axios'
import { compare } from 'compare-versions'
import { createWriteStream } from 'node:fs'
import { access, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { appConfig } from '/@/constants'
import { sendLaunchMessage } from '/@/modules/app/checkResource/index'
import { fileExists, isMac } from '/@/utils'

// roxySync 下载重试次数
let roxySyncDownloadRetry = 0
/** 检查 roxySync 是否存在 */
export async function checkRoxySyncBin(webDomain: string) {
  const { promise, resolve } = Promise.withResolvers()
  // 获取文件所在的目录路径
  const roxySyncBinDir = dirname(appConfig.roxySyncBinPath)
  await fileExists(roxySyncBinDir, true)
  const roxySyncBinExist = await fileExists(appConfig.roxySyncBinPath)

  const platform = isMac ? 'macos' : 'windows'
  let arch = ''
  if (isMac) {
    arch = process.arch === 'x64' ? 'intel' : 'apple'
  }
  else {
    arch = process.arch === 'x64' ? 'x64' : 'x86'
  }
  const binFile = `roxy-sync${isMac ? '' : '.exe'}`

  // roxySync 执行文件下载地址
  const downloadUrl = `${webDomain}/public/static/roxysync/${platform}/${arch}/${binFile}`
  // roxySync 版本文件下载地址
  const versionUrl = `${webDomain}/public/static/roxysync/${platform}/version`
  // roxySync 版本文件本地路径
  const localVersionFilePath = join(roxySyncBinDir, 'version')
  // roxySync 版本文件本地版本
  const localVersion = await access(localVersionFilePath)
    .then(async () => (await readFile(localVersionFilePath)).toString())
    .catch(() => '')

  // 下载 roxySync 版本文件
  const remoteVersion = await axios({
    url: versionUrl,
    method: 'get',
    timeout: 5000,
  }).then(async (response) => {
    const version = response.data.toString()

    writeFile(localVersionFilePath, version)
    console.log('roxySync version', version)
    return version
  })

  if (!roxySyncBinExist || compare(remoteVersion, localVersion, '>')) {
    console.log('正在下载 roxySync')
    // 下载 roxySync
    const response = await axios({
      url: downloadUrl,
      method: 'get',
      responseType: 'stream',
      onDownloadProgress: (progressEvent) => {
        const total = progressEvent.total || 0
        const current = progressEvent.loaded
        const percentage = Math.round((current / total) * 100)
        console.log(`Download progress: ${percentage}%`)
        sendLaunchMessage($t('正在下载 roxySync {percentage}%', { percentage }))
      },
    })
    const writer = createWriteStream(appConfig.roxySyncBinPath)

    response.data.pipe(writer)

    // 下载失败需要重新下载
    writer.on('error', async (error) => {
      console.error('Download roxySync error', error)
      try {
        await rm(localVersionFilePath)
        await rm(appConfig.roxySyncBinPath)
      }
      catch (error) {

      }
      finally {
        if (roxySyncDownloadRetry < 3) {
          roxySyncDownloadRetry++
          await checkRoxySyncBin(webDomain)
        }
        else {
          resolve(true)
        }
      }
    })

    writer.on('finish', () => {
      writer.close()
      sendLaunchMessage($t('roxy-sync 下载完成'))
      resolve(true)
    })
  }
  else {
    resolve(true)
  }

  return promise
}
