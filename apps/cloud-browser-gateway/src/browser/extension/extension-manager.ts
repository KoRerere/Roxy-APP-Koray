import { compare } from 'compare-versions'
import crypto from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { readdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { API } from '~/api'
import { fileExists, unzipToDirectory } from '~/utils'
import { getPluginDir, getPluginManifestInfo } from './helper'
import axios from 'axios'

/** 正在下载的插件（进程级去重，key 是本地路径） */
const downloadingExtensions = new Map<string, Promise<string>>()

interface ExtensionManagerOptions {
  workspaceId: number
  token: string
  extensionBaseDir: string
}

export class ExtensionManager {
  private workspaceId: number
  private token: string

  get extensionDir() {
    return path.join(this.extensionBaseDir, `w_${this.workspaceId}`)
  }

  get requestHeaders() {
    return { workspaceId: this.workspaceId, token: this.token }
  }

  constructor(private options: ExtensionManagerOptions) {
    this.workspaceId = options.workspaceId
    this.token = options.token
    this.extensionBaseDir = options.extensionBaseDir
  }

  private extensionBaseDir: string

  /** 获取本地所有插件目录名 */
  async getAllExtensions(): Promise<string[]> {
    await fileExists(this.extensionDir, true)
    const files = await readdir(this.extensionDir, { withFileTypes: true })
    return files.filter(n => n.isDirectory()).map(n => n.name)
  }

  /**
   * 获取指定插件列表的本地路径（自动下载缺失或过期的）
   * @returns 扩展绝对路径列表，供 --load-extension= 使用
   */
  async getTargetExtensions(pluginList: Record<string, string>[]): Promise<string[]> {
    const localExtensions = await this.getAllExtensions()

    const needDownloads: string[] = []
    const notNeedDownloads: string[] = []

    for (const item of pluginList) {
      const { pluginDir, pluginVersion } = item

      if (localExtensions.includes(pluginDir)) {
        const localVersion = await getPluginManifestInfo(path.join(this.extensionDir, pluginDir))
          .then(({ manifestInfo }) => manifestInfo.version)
          .catch(() => '')

        if (!localVersion || compare(localVersion, pluginVersion, '<')) {
          needDownloads.push(pluginDir)
        }
        else {
          notNeedDownloads.push(pluginDir)
        }
      }
      else {
        needDownloads.push(pluginDir)
      }
    }

    let downloadedArr: string[] = []
    if (needDownloads.length) {
      console.log(`正在下载 ${needDownloads.length} 个扩展...`)
      const promiseArr = await this.downloadUserExtensions(needDownloads)
      downloadedArr = promiseArr
        .filter(p => p.status === 'fulfilled')
        .map(p => (p as PromiseFulfilledResult<string>).value)
      const failedArr = promiseArr
        .filter(p => p.status === 'rejected')
        .map(p => (p as PromiseRejectedResult).reason?.message || '未知错误')
      if (failedArr.length) {
        console.warn('扩展下载失败列表：', failedArr)
      }
    }

    const allDirs = notNeedDownloads
      .map(name => path.join(this.extensionDir, name))
      .concat(downloadedArr)

    return Promise.all(allDirs.map(extDir => getPluginDir(extDir, 10)))
  }

  /** 从用户插件列表中下载指定的插件 */
  private async downloadUserExtensions(extIDs: string[]) {
    const { data } = await API.plugins.userGetPluginListList({}, { headers: this.requestHeaders })
    const needDownloads = data.rows.filter(item => extIDs.includes(item.pluginDir!))
    return this.downloadExtensions(needDownloads)
  }

  /** 下载并安装插件列表 */
  private async downloadExtensions(extensions: { pluginDir?: string, pluginRoute?: string, pluginName?: string, hashValue?: string }[]) {
    const promiseArr = extensions.map(async (item) => {
      const localPath = path.join(this.extensionDir, item.pluginDir!)
      const zipPath = `${localPath}.zip`

      const startDownload = async () => {
        try {
          await this.downloadFile(item.pluginRoute as string, zipPath)

          if (item.hashValue) {
            const hash = crypto.createHash('sha512')
            hash.update(await readFile(zipPath))
            const hashValue = hash.digest('hex')
            if (hashValue !== item.hashValue) {
              API.plugins.userReportSystemPluginErrorCreate({ pluginDir: item.pluginDir! })
              await rm(zipPath, { force: true })
              throw new Error($t('扩展 {pluginName} 校验失败，可能已被篡改', { pluginName: item.pluginName }))
            }
          }

          await rm(localPath, { recursive: true, force: true })
          await unzipToDirectory(zipPath, localPath)
          await rm(zipPath, { force: true })
          console.log(`扩展 ${item.pluginDir} 安装成功`)
          return localPath
        }
        catch (error: any) {
          console.error(`扩展 ${item.pluginDir} 安装失败：`, error.message)
          throw new Error($t('扩展 {pluginName} 安装失败', { pluginName: item.pluginName }), { cause: error })
        }
        finally {
          downloadingExtensions.delete(localPath)
        }
      }

      const promise = downloadingExtensions.get(localPath) || startDownload()
      downloadingExtensions.set(localPath, promise)
      return promise
    })

    return Promise.allSettled(promiseArr)
  }

  /** 流式下载文件 */
  private async downloadFile(url: string, destPath: string) {
    await fileExists(path.dirname(destPath), true)
    const response = await axios.get(url, { responseType: 'stream', timeout: 60_000 })
    await pipeline(response.data, createWriteStream(destPath))
  }
}
