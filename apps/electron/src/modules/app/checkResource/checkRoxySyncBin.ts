import axios from 'axios'
import { compare } from 'compare-versions'
import { createWriteStream } from 'node:fs'
import { access, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { appConfig } from '/@/constants'
import { sendLaunchMessage } from '/@/modules/app/checkResource/index'
import { calculateFileHash, fileExists, isMac } from '/@/utils'

// roxySync 下载重试次数
let roxySyncDownloadRetry = 0
// 获取文件所在的目录路径
const roxySyncBinDir = dirname(appConfig.roxySyncBinPath)

const platform = isMac ? 'macos' : 'windows'
let arch = ''
if (isMac) {
  arch = process.arch === 'x64' ? 'intel' : 'apple'
}
else {
  arch = process.arch === 'x64' ? 'x64' : 'x86'
}
const binFile = `roxy-sync${isMac ? '' : '.exe'}`

const config = {
  /** 资源服务器域名 */
  webDomain: '',
  /** roxySync 版本文件本地路径 */
  localVersionFilePath: join(roxySyncBinDir, 'version'),
  /** roxySync 执行文件下载地址 */
  get downloadUrl() {
    return `${config.webDomain}/public/static/roxysync/${platform}/${arch}/${binFile}`
  },
  /** roxySync 版本文件下载地址 */
  get versionUrl() {
    return `${config.webDomain}/public/static/roxysync/version`
  },
  /** roxySync sha512 哈希值文件下载地址 */
  get sha512Url() {
    return `${config.webDomain}/public/static/roxysync/${platform}/${arch}/sha512`
  },
}



/** 检查 roxySync 是否存在 */
export async function checkRoxySyncBin(webDomain: string) {
  config.webDomain = webDomain
  const { promise, resolve } = Promise.withResolvers()

  await fileExists(roxySyncBinDir, true)
  const roxySyncBinExist = await fileExists(appConfig.roxySyncBinPath)

  // roxySync 版本文件本地版本
  const localVersion = await access(config.localVersionFilePath)
    .then(async () => (await readFile(config.localVersionFilePath)).toString())
    .catch(() => '')

  // 下载 roxySync 版本文件
  const remoteVersion = await axios({
    url: config.versionUrl,
    method: 'get',
    timeout: 5000,
  }).then(async (response) => {
    const version = response.data.toString()

    writeFile(config.localVersionFilePath, version)
    console.log('roxySync version', version)
    return version
  })

  let needDownload = !roxySyncBinExist || compare(remoteVersion, localVersion, '>')

  // 如果 roxySync 执行文件存在，则检查 sha512 哈希值
  if (roxySyncBinExist) {
    const remoteSha512 = await axios({
      url: config.sha512Url,
      method: 'get',
      timeout: 5000,
    }).then(async (response) => response.data.toString()).catch(() => '')

    console.log('roxySync remoteSha512', remoteSha512)
    // 如果远程 sha512 哈希值存在，则检查本地 sha512 哈希值
    if (remoteSha512) {
      const localSha512 = await calculateFileHash(appConfig.roxySyncBinPath)
      console.log('roxySync localSha512', localSha512)
      if (remoteSha512 !== localSha512) {
        needDownload = true
      }
    } else {
      needDownload = true
    }
  }

  if (needDownload) {
    await downloadRoxySyncBin()
    resolve(true)
  }
  else {
    resolve(true)
  }

  return promise
}


/** 下载 roxySync */
async function downloadRoxySyncBin() {
  const { promise, resolve } = Promise.withResolvers()
  console.log('正在下载 roxySync')
  // 下载 roxySync
  const response = await axios({
    url: config.downloadUrl,
    method: 'get',
    responseType: 'stream',
    onDownloadProgress: (progressEvent) => {
      const total = progressEvent.total || 0
      const current = progressEvent.loaded
      const percentage = Math.round((current / total) * 100)
      console.log(`Download roxySync progress: ${percentage}%`)
      sendLaunchMessage($t('正在下载 roxySync {percentage}%', { percentage }))
    },
  })
  const writer = createWriteStream(appConfig.roxySyncBinPath)

  response.data.pipe(writer)

  // 下载失败需要重新下载
  writer.on('error', async (error) => {
    console.error('Download roxySync error', error)
    try {
      writer.close()
      await rm(config.localVersionFilePath)
      await rm(appConfig.roxySyncBinPath)
    }
    catch (error) {

    }
    finally {
      if (roxySyncDownloadRetry < 3) {
        roxySyncDownloadRetry++
        await downloadRoxySyncBin()
        resolve(true)
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

  return promise
}

