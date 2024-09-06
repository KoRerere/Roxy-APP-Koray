import { readFile, readdir, rm, stat } from 'node:fs/promises'
import { appConfig, mediaProtocolName, ossObject } from '/@/constants/'
import path from 'node:path'
import crypto from 'node:crypto'
import { API } from '/@/api'
import { aliOSS, downloadZipFile, fileExists, getErrorMessage, unzipFile } from '/@/utils'
import { Worker } from 'node:worker_threads'
import type { UnwrapRowType, UnwrapRowsType, UserGetPluginListListData, UserGetSystemPluginListData } from '@roxy/backend-api'
import { dialog } from 'electron'
import { getMainWindow } from '/@/modules/app/mainWindow'
import { unzip } from '@tomjs/unzip-crx'
import AdmZip from 'adm-zip'
import { compare } from 'compare-versions'
import { getPluginManifestInfo, getPluginMeta } from './helper'
import type { CheckLocalExtensionUpdatePayload, UploadExtensionToOSSResult } from '/@/modules/extension/types'

export const extensionManager = new class ExtensionManager {
  /** 插件目录 */
  get extensionDir() {
    return appConfig.browserExtensionsDir
  }

  /** 获取本地所有插件 */
  async getAllExtensions() {
    await fileExists(this.extensionDir, true)
    const files = await readdir(this.extensionDir, { withFileTypes: true })
    return files.filter(n => n.isDirectory()).map(n => n.name)
  }

  /** 根据插件 ID 获取指定的插件，本地不存在则自动下载 */
  async getExtensionByIds(extIDs: string[], msgCallback?: (msg: string) => void) {
    const localExtensions = await this.getAllExtensions()

    const { exists = [], noExists = [] } = Object.groupBy(extIDs, (extId) => {
      if (localExtensions.includes(extId)) {
        return 'exists'
      }
      else {
        return 'noExists'
      }
    })

    let downloadedArr: string[] = []
    if (noExists.length) {
      msgCallback?.('正在下载插件')
      const promiseArr = await this.downloadUserExtensions(noExists)
      downloadedArr = promiseArr.filter(p => p.status === 'fulfilled').map(p => p.value)
      const failedArr = promiseArr.filter(p => p.status === 'rejected').map(p => getErrorMessage(p.reason))
      if (failedArr.length) {
        msgCallback?.(failedArr.join(', '))
      }
    }

    return exists.map(name => path.join(this.extensionDir, name)).concat(downloadedArr)
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
        return Promise.reject(new Error(`${item.pluginName} 插件下载失败`))
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
      return Promise.reject('插件目录或插件图标不能为空')
    }

    const manifestExist = await fileExists(path.join(pluginDir, 'manifest.json'))

    if (!manifestExist) {
      return Promise.reject('插件目录下不存在 manifest.json 文件')
    }
    const manifestFile = await readFile(path.join(pluginDir, 'manifest.json'), 'utf-8')

    // 创建一个MD5哈希对象，并使用文件数据更新哈希值
    const hash = crypto.createHash('md5')
    hash.update(manifestFile)

    // 计算并获取哈希值的十六进制表示插件目录名
    const dirName = hash.digest('hex')

    pluginIcon = pluginIcon.replace(`${mediaProtocolName}:///`, '')
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
    const { promise, resolve } = Promise.withResolvers()
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
        resolve({ type: 'warning', message: '插件大小不能超过100MB' })
        return promise
      }

      if (pluginStat.isFile() && fileExtname !== '.crx' && fileExtname !== '.zip') {
        resolve({ type: 'warning', message: '请选择正确的插件文件' })
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

      await import('./extensionWorker')
      const worker = new Worker(path.join(__dirname, 'extensionWorker.cjs'))

      if (fileExtname === '.zip') {
        const tempDir = path.join(appConfig.tempDir, 'zip')
        const { name } = path.parse(pluginDir)
        const destDir = path.join(tempDir, name)

        await fileExists(tempDir, true)

        worker.on('message', async (result) => {
          const { type, data } = result

          if (type === 'extractPlugin') {
            console.log('extractPlugin', data)
            try {
              const pluginMeta = await getPluginMeta(destDir)
              resolve({ type: 'success', data: pluginMeta })
            }
            catch (error) {
              resolve({ type: 'error', data: error })
            }
            finally {
              worker.terminate()
            }
          }
          else if (type === 'error') {
            resolve({ type: 'error', data })
            worker.terminate()
          }
        })

        worker.on('error', (error) => {
          console.error('Worker error:', error)
          resolve({ type: 'error', data: error })
          worker.terminate()
        })

        worker.postMessage({ type: 'extractPlugin', data: { pluginDir, destDir: tempDir } })

        return promise
      }

      console.log('pluginDir', pluginDir)

      worker.on('message', async (result) => {
        const { type, data } = result

        if (type === 'calculatePluginSize') {
          console.log('calculatePluginSize', data)
          if (data > 1024 * 1024 * 100) {
            resolve({ type: 'warning', message: '插件大小不能超过100MB' })
          }
          else {
            try {
              const pluginMeta = await getPluginMeta(pluginDir)
              resolve({ type: 'success', data: pluginMeta })
            }
            catch (error) {
              resolve({ type: 'error', data: error })
            }
            finally {
              worker.terminate()
            }
          }
        }
      })

      worker.on('error', (error) => {
        console.error('Worker error:', error)
        resolve({ type: 'error', data: error })
        worker.terminate()
      })

      // 传递插件目录给子线程, 让子线程计算插件大小
      worker.postMessage({ type: 'calculatePluginSize', data: pluginDir })
    }
    else {
      resolve({ type: 'warning', message: '未选择插件目录' })
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
}()
