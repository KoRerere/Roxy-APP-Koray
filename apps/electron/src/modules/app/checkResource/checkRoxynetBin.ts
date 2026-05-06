import { compare } from 'compare-versions'
import { createWriteStream } from 'node:fs'
import { access, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { appConfig } from '/@/constants'
import { currentArch, currentOS, isWindows } from '/@/constants/common'
import { sendLaunchMessage } from '/@/modules/app/checkResource/index'
import { calculateFileHash, fileExists, request } from '/@/utils'

// roxynet 下载重试次数
let roxynetDownloadRetry = 0

// 获取文件所在的目录路径
const roxynetBinDir = dirname(appConfig.roxynetBinPath)

const binFile = `roxynet${isWindows ? '.exe' : ''}`

const config = {
  /** 资源服务器域名 */
  webDomain: '',
  /** roxynet 版本文件本地路径 */
  localVersionFilePath: join(roxynetBinDir, 'version'),
  /** roxynet 执行文件下载地址 */
  get downloadUrl() {
    return `${config.webDomain}/public/static/roxynet/${currentOS}/${currentArch}/${binFile}`
  },
  /** roxynet 版本文件下载地址 */
  get versionUrl() {
    return `${config.webDomain}/public/static/roxynet/version`
  },
  /** roxynet sha512 哈希值文件下载地址 */
  get sha512Url() {
    return `${config.webDomain}/public/static/roxynet/${currentOS}/${currentArch}/sha512`
  },
}

/** 检查 roxynet 是否存在 */
export async function checkRoxynetBin(webDomain: string) {
  config.webDomain = webDomain
  const { promise, resolve } = Promise.withResolvers()

  await fileExists(roxynetBinDir, true)
  const roxynetBinExist = await fileExists(appConfig.roxynetBinPath)

  // roxynet 版本文件本地版本
  const localVersion = await access(config.localVersionFilePath)
    .then(async () => (await readFile(config.localVersionFilePath)).toString())
    .catch(() => '')

  // 下载 roxynet 版本文件
  const remoteVersion = await request({
    url: config.versionUrl,
    method: 'get',
    timeout: 3000,
  }).then(async (response) => {
    const version = response.data.toString()

    writeFile(config.localVersionFilePath, version)
    console.log('roxynet version', version)
    return version
  })

  // 如果 roxynet 执行文件不存在，或者远程版本大于本地版本，则下载 roxynet
  let needDownload = !roxynetBinExist || compare(remoteVersion, localVersion, '>')

  // 如果 roxynet 执行文件存在，则检查 sha512 哈希值
  if (roxynetBinExist) {
    const remoteSha512 = await request({
      url: config.sha512Url,
      method: 'get',
      timeout: 5000,
    }).then(async response => response.data.toString()).catch(() => '')

    console.log('roxyNet remoteSha512', remoteSha512)
    // 如果远程 sha512 哈希值存在，则检查本地 sha512 哈希值
    if (remoteSha512) {
      const localSha512 = await calculateFileHash(appConfig.roxynetBinPath)
      console.log('roxyNet localSha512', localSha512)
      if (remoteSha512 !== localSha512) {
        needDownload = true
      }
    }
    else {
      needDownload = true
    }
  }

  if (needDownload) {
    await downloadRoxynetBin()
    resolve(true)
  }
  else {
    resolve(true)
  }

  return promise
}

/** 下载 roxynet */
async function downloadRoxynetBin() {
  const { promise, resolve } = Promise.withResolvers()
  console.log('Downloading roxynet')
  // 下载 roxynet
  const response = await request({
    url: config.downloadUrl,
    method: 'get',
    responseType: 'stream',
    onDownloadProgress: (progressEvent) => {
      const total = progressEvent.total || 0
      const current = progressEvent.loaded
      const percentage = Math.round((current / total) * 100)
      console.log(`Download roxynet progress: ${percentage}%`)
      sendLaunchMessage($t('正在下载 roxynet {percentage}%', { percentage }))
    },
  })
  const writer = createWriteStream(appConfig.roxynetBinPath)

  response.data.pipe(writer)

  // 下载失败需要重新下载
  writer.on('error', async (error) => {
    console.error('Download roxynet error', error)
    try {
      writer.close()
      await rm(config.localVersionFilePath)
      await rm(appConfig.roxynetBinPath)
    }
    catch (error) {
      console.error('Download roxynet error 2', error)
    }
    finally {
      if (roxynetDownloadRetry < 3) {
        roxynetDownloadRetry++
        await downloadRoxynetBin()
        resolve(true)
      }
      else {
        resolve(true)
      }
    }
  })

  writer.on('finish', () => {
    writer.close()
    sendLaunchMessage($t('roxynet 下载完成'))
    resolve(true)
  })

  return promise
}
