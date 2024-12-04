import type { UnwrapRowsType, UnwrapRowType, UserGetPluginListListData, UserGetSystemPluginListData } from '@roxy/backend-api'
import { unzip } from '@tomjs/unzip-crx'
import AdmZip from 'adm-zip'
import { compare } from 'compare-versions'
import { dialog } from 'electron'
import crypto from 'node:crypto'
import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { CheckLocalExtensionUpdatePayload, UploadExtensionToOSSResult } from '/@/modules/extension/types'
import { API } from '/@/api'
import { appConfig, mediaProtocolName, ossObject } from '/@/constants/'
import { getMainWindow } from '/@/modules/app/mainWindow'
import { fileOperations } from '/@/modules/fileOperations'
import { aliOSS, downloadZipFile, fileExists, getErrorMessage, isMac, unzipFile } from '/@/utils'
import { genExtensionKey, getPluginDir, getPluginManifestInfo, getPluginMeta } from './helper'
import { store } from '/@/modules/store'

export interface UserSelectedExtensionInfo {
  type: 'warn' | 'success' | 'error'
  message?: string
  data?: Awaited<ReturnType<typeof getPluginMeta>>
}

interface ExtensionManagerOptions {
  workspaceId?: string
}

export class ExtensionManager {
  /** 工作空间 ID */
  workspaceId: string
  /** 插件目录 */
  get extensionDir() {
    return `${appConfig.browserExtensionsDir}/w_${this.workspaceId}`
  }

  constructor({ workspaceId }: ExtensionManagerOptions = {}) {
    this.workspaceId = workspaceId || String(store.workspaceId)
  }

  /** 获取本地所有插件 */
  async getAllExtensions() {
    await fileExists(this.extensionDir, true)
    const files = await readdir(this.extensionDir, { withFileTypes: true })
    return files.filter(n => n.isDirectory()).map(n => n.name)
  }

  /** 根据插件 ID 和 版本号 获取指定的插件，本地不存在则自动下载 */
  async getTargetExtensions(pluginList: Record<string, string>[], msgCallback?: (msg: string) => void): Promise<string[]> {
    const localExtensions = await this.getAllExtensions()

    const { needDownloads = [], notNeedDownloads = [] } = await pluginList.reduce<Promise<{ needDownloads: string[], notNeedDownloads: string[] }>>(async (acc, item) => {
      const accObj = await acc
      const { pluginDir, pluginVersion, fixedPlugin } = item

      if (localExtensions.includes(pluginDir)) {
        const localVersion = await getPluginManifestInfo(path.join(this.extensionDir, pluginDir))
          .then(({ manifestInfo }) => manifestInfo.version)
          .catch(() => '')

        if (!localVersion || compare(localVersion, pluginVersion, '<')) {
          accObj.needDownloads.push(pluginDir)
        }
        else {
          accObj.notNeedDownloads.push(pluginDir)
        }
      }
      else {
        accObj.needDownloads.push(pluginDir)
      }
      return accObj
    }, { needDownloads: [], notNeedDownloads: [] })

    let downloadedArr: string[] = []
    if (needDownloads.length) {
      msgCallback?.($t('正在下载扩展'))
      const promiseArr = await this.downloadUserExtensions(needDownloads)
      downloadedArr = promiseArr.filter(p => p.status === 'fulfilled').map(p => p.value)
      const failedArr = promiseArr.filter(p => p.status === 'rejected').map(p => getErrorMessage(p.reason))
      if (failedArr.length) {
        msgCallback?.(failedArr.join(', '))
      }
    }

    const promiseArr = notNeedDownloads.map(name => path.join(this.extensionDir, name)).concat(downloadedArr).map((extDir) => {
      return getPluginDir(extDir, 10)
    })
    return Promise.all(promiseArr)
  }

  /** 从用户插件列表下载所需的插件 */
  async downloadUserExtensions(extIDs: string[]) {
    const { data } = await API.plugins.userGetPluginListList({})
    const needDownloads = data.rows.filter(item => extIDs.includes(item.pluginDir!))
    return this.downloadExtensions(needDownloads)
  }

  /** 下载指定的插件 */
  async downloadExtensions(extensions: UnwrapRowsType<UserGetSystemPluginListData | UserGetPluginListListData>) {
    const promiseArr = extensions.map(async (item) => {
      const localPath = path.join(this.extensionDir, item.pluginDir!)
      const zipPath = `${localPath}.zip`
      try {
        await downloadZipFile(item.pluginRoute!, zipPath)
        await unzipFile(zipPath)
        rm(zipPath)
        return localPath
      }
      catch (error) {
        console.error('downloadExtensions error', error)
        return Promise.reject(new Error($t('扩展 {pluginName} 下载失败', { pluginName: item.pluginName })))
      }
    })
    return Promise.allSettled(promiseArr)
  }

  /** 删除指定插件 */
  async removeExtensions(extIDs: string[]) {
    const promiseArr = extIDs.map(async (extID) => {
      const localPath = path.join(this.extensionDir, extID)
      await rm(localPath, { recursive: true, force: true })
      return localPath
    })
    return Promise.allSettled(promiseArr)
  }

  /** 上传本地插件到 OSS */
  async uploadExtensionToOSS(params: UnwrapRowType<UserGetPluginListListData>) {
    let { pluginDir, pluginIcon } = params
    const { promise, resolve, reject } = Promise.withResolvers<UploadExtensionToOSSResult>()

    if (!pluginDir || !pluginIcon) {
      return Promise.reject(new Error($t('扩展目录或扩展图标不能为空')))
    }

    const manifestExist = await fileExists(path.join(pluginDir, 'manifest.json'))

    if (!manifestExist) {
      return Promise.reject(new Error($t('扩展目录下不存在 manifest.json 文件')))
    }
    const manifestFilePath = path.join(pluginDir, 'manifest.json')
    const manifestFile = await readFile(manifestFilePath, 'utf-8')

    try {
      const manifestInfo = JSON.parse(manifestFile)
      if (!manifestInfo.key) {
        manifestInfo.key = genExtensionKey()
        await writeFile(manifestFilePath, JSON.stringify(manifestInfo, null, 2), 'utf-8')
      }
    } catch (error) {
      console.error('parse manifestFile error', error)
    }

    // 创建一个MD5哈希对象，并使用文件数据更新哈希值
    const hash = crypto.createHash('md5')
    hash.update(manifestFile)

    // 计算并获取哈希值的十六进制表示插件目录名
    const dirName = hash.digest('hex')

    pluginIcon = pluginIcon.replace(`${mediaProtocolName}:///`, isMac ? '/' : '')

    const zip = new AdmZip()
    // 获取目录名
    // const dirName = path.basename(pluginDir);
    // 获取图片后缀名
    const iconExtName = path.extname(pluginIcon)

    console.log('upload-plugin', pluginDir, pluginIcon, dirName)

    zip.addLocalFolder(path.normalize(pluginDir))
    const zipBuffer = zip.toBuffer()

    try {
      const basePath = ossObject.userPluginDataDir
      const promises = [
        aliOSS.put(`${basePath}/${dirName}.zip`, zipBuffer),
        aliOSS.put(`${basePath}/${dirName}${iconExtName}`, pluginIcon),
      ]
      console.log('upload-plugin promises', `${basePath}/${dirName}.zip`)
      console.log('upload-plugin promises', `${basePath}/${dirName}${iconExtName}`)
      const [pluginResult, iconResult] = await Promise.all(promises)
      const result: UploadExtensionToOSSResult = {
        pluginRoute: pluginResult.url,
        pluginIcon: iconResult.url,
        pluginDir: dirName,
      }
      console.log('upload-plugin result', result)
      resolve(result)
    }
    catch (err) {
      reject(err)
    }

    return promise
  }

  /** 获取并解析用户本地选择的插件信息 */
  async getUserSelectedExtensionInfo(selectType: 'dir' | 'file') {
    const { promise, resolve } = Promise.withResolvers<UserSelectedExtensionInfo>()
    const { canceled, filePaths } = await dialog.showOpenDialog(getMainWindow()!, {
      properties: [selectType === 'dir' ? 'openDirectory' : 'openFile'],
      // .crx .zip
      filters: [
        { name: 'CRX and ZIP Files', extensions: ['crx', 'zip'] },
      ],
    })

    if (!canceled && filePaths.length > 0) {
      // 选择的插件目录
      const pluginDir = filePaths[0]
      const fileExtname = path.extname(pluginDir)

      const pluginStat = await stat(pluginDir)

      if (pluginStat.size > 1024 * 1024 * 100) {
        resolve({ type: 'warn', message: $t('扩展大小不能超过 100MB') })
        return promise
      }

      if (pluginStat.isFile() && fileExtname !== '.crx' && fileExtname !== '.zip') {
        resolve({ type: 'warn', message: $t('请选择正确的扩展文件') })
        return promise
      }

      if (fileExtname === '.crx') {
        const tempDir = path.join(appConfig.tempDir, 'crx')
        const { name } = path.parse(pluginDir)
        const destDir = path.join(tempDir, name)

        await fileExists(tempDir, true)
        await unzip(pluginDir, destDir)
        try {
          const pluginMeta = await getPluginMeta(destDir)
          resolve({ type: 'success', data: pluginMeta })
        }
        catch (error) {
          resolve({ type: 'error', data: error })
        }

        return promise
      }

      if (fileExtname === '.zip') {
        const tempDir = path.join(appConfig.tempDir, 'zip')
        const { name } = path.parse(pluginDir)
        const destDir = path.join(tempDir, name)

        await fileExists(tempDir, true)

        try {
          const extractDir = await fileOperations.executeTask('decompress', { src: pluginDir, dest: destDir })
          console.log('extractPlugin dir', extractDir)

          const pluginMeta = await getPluginMeta(destDir)
          resolve({ type: 'success', data: pluginMeta })
        }
        catch (error) {
          resolve({ type: 'error', data: error })
        }

        return promise
      }

      console.log('pluginDir', pluginDir)

      // 计算插件大小
      const pluginSize = await fileOperations.executeTask('getCompressedSize', pluginDir)
      console.log('calculatePluginSize', pluginSize)
      if (pluginSize > 1024 * 1024 * 100) {
        resolve({ type: 'warn', message: $t('扩展大小不能超过 100MB') })
      }
      else {
        try {
          const pluginMeta = await getPluginMeta(pluginDir)
          resolve({ type: 'success', data: pluginMeta })
        }
        catch (error) {
          resolve({ type: 'error', data: error })
        }
      }
    }
    else {
      resolve({ type: 'warn', message: $t('未选择插件目录') })
    }

    return promise
  }

  /** 获取本地已安装的插件 */
  async getInstalledExtensions() {
    const extIds = await this.getAllExtensions()
    const promiseArr = extIds.map(async (extID) => {
      const pluginDir = path.join(this.extensionDir, extID)
      return getPluginMeta(pluginDir)
    })

    const result = await Promise.allSettled(promiseArr)
    return result.filter(p => p.status === 'fulfilled').map(p => p.value)
  }

  /** 检测本地插件是否有可用的更新，返回结果是插件ID字符串数组，表示本地哪些插件时可以更新的 */
  async checkLocalExtensionUpdate(checkList: CheckLocalExtensionUpdatePayload) {
    const checkPromises = checkList.map(async ({ extID, newVersion }) => {
      const pluginDir = path.join(this.extensionDir, extID)
      const isExist = await fileExists(pluginDir)
      if (!isExist) {
        return ''
      }
      try {
        const { manifestInfo } = await getPluginManifestInfo(pluginDir)
        // 如果本地插件版本小于最新版本，则返回插件ID
        if (compare(manifestInfo.version, newVersion, '<')) {
          return extID
        }
      }
      catch (error) {
        return ''
      }
    })

    const result = await Promise.all(checkPromises)

    return result.filter((id): id is string => Boolean(id))
  }
}
