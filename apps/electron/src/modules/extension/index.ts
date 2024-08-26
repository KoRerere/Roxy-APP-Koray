import { readdir, rm } from 'node:fs/promises'
import { appConfig } from '/@/constants/'
import { join } from 'node:path'
import { API } from '/@/api'
import { downloadZipFile, fileExists, getErrorMessage, unzipFile } from '/@/utils'

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
      const promiseArr = await this.downloadExtensions(noExists)
      downloadedArr = promiseArr.filter(p => p.status === 'fulfilled').map(p => p.value)
      const failedArr = promiseArr.filter(p => p.status === 'rejected').map(p => getErrorMessage(p.reason))
      if (failedArr.length) {
        msgCallback?.(failedArr.join(', '))
      }
    }

    return exists.map(name => join(this.extensionDir, name)).concat(downloadedArr)
  }

  /** 下载指定插件 */
  async downloadExtensions(extIDs: string[]) {
    const { data } = await API.plugins.userGetPluginListList({})
    const needDownloads = data.rows.filter(item => extIDs.includes(item.pluginDir!))
    const promiseArr = needDownloads.map(async (item) => {
      const localPath = join(this.extensionDir, item.pluginDir!)
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
      const localPath = join(this.extensionDir, extID)
      await rm(localPath, { recursive: true })
      return localPath
    })
    return Promise.allSettled(promiseArr)
  }
}()
