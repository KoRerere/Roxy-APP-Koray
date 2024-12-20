import axios from 'axios'
import { compare } from 'compare-versions'
import { app } from 'electron'
import { createWriteStream } from 'node:fs'
import { dirname, join } from 'node:path'
import { getWebDomain } from '/@/api/util'
import { appConfig } from '/@/constants'
import { getLocalWebVersion, getMainWindow, getWebEntryUrl, updateMainWindowPageTitle } from '/@/modules/app/mainWindow'
import { fileOperations } from '/@/modules/fileOperations'
import { fileExists, isMac } from '/@/utils'
import { ResourceUpdateMessage } from '@roxy/electron-preload'
import { ipcMain } from '/@/modules/ipc'
import { store } from '/@/modules/store'

interface VersionInfo {
  /** 最新版本号 */
  version: string
  /** 最低支持版本号 */
  minimum_app_version: string
  /** 发布时间 */
  releaseTime: string
}

interface CheckForUpdatesOptions {
  onDownloadProgress?: (percentage: number) => void
  onDownloadComplete?: () => any
}

export const webUpdater = new class WebUpdater {
  timer: NodeJS.Timeout | null = null
  /** web 资源包下载地址 */
  webDomain = ''
  /** web zip 资源包路径 */
  webZipPath = join(appConfig.tempDir, 'web.zip')
  /** 是否在下载中 */
  isInProgress = false
  /** 远程 web 资源版本信息 */
  remoteVersionInfo: VersionInfo | null = null
  /** 更新信息消息体 */
  #updateMessageData: ResourceUpdateMessage = {
    type: 'web',
    percent: 0,
    description: '',
    get title() {
      return $t('UI 资源更新')
    },
  }
  /** 最新 web 资源版本号文件地址 */
  get versionUrl() {
    return `${this.webDomain}/public/package/web/${isMac ? 'macOS' : 'Windows'}/version.json`
  }

  /** web 资源包下载地址 */
  get downloadUrl() {
    return `${this.webDomain}/public/package/web/${isMac ? 'macOS' : 'Windows'}/dist.zip`
  }

  constructor() {
    // this.startInterval()
  }

  async startInterval() {
    this.stopInterval()
    this.timer = setInterval(() => {
      this.checkForUpdates()
    }, 1000 * 60 * 10)
  }

  async stopInterval() {
    if (this.timer) {
      clearInterval(this.timer)
    }
  }

  async checkForUpdates(options?: CheckForUpdatesOptions) {
    if (this.isInProgress) {
      return
    }
    if (this.remoteVersionInfo) {
      this.sendSuccessMessage()
      console.log('[WebUpdater] checkForUpdates already downloaded')
      return
    }
    this.isInProgress = true
    console.log('[WebUpdater] checkForUpdates start')
    try {
      this.webDomain = await getWebDomain()
      // 获取远程版本信息
      const remoteVersionInfo = await axios.get<VersionInfo>(this.versionUrl).then(response => response.data)
      console.log('[WebUpdater] remoteVersionInfo', remoteVersionInfo)

      // 检查 app 版本是否过低
      if (compare(remoteVersionInfo.minimum_app_version, app.getVersion(), '>')) {
        console.log('[WebUpdater] app version is too old')
        this.isInProgress = false
        return
      }
      // 获取本地版本信息
      const localVersion = await getLocalWebVersion()
      console.log('[WebUpdater] localVersion', localVersion)
      // 检查是否需要更新
      if (compare(remoteVersionInfo.version, localVersion, '>')) {
        this.#updateMessageData.originUpgradeData = remoteVersionInfo
        this.#updateMessageData.version = remoteVersionInfo.version
        this.#updateMessageData.releaseTime = remoteVersionInfo.releaseTime
        console.log('[WebUpdater] downloading...')
        const response = await axios({
          url: this.downloadUrl,
          method: 'get',
          responseType: 'stream',
          onDownloadProgress: (progressEvent) => {
            const total = progressEvent.total || 0
            const current = progressEvent.loaded
            const percentage = Math.round((current / total) * 100)
            console.log(`[WebUpdater] Download progress: ${percentage}%`)
            options?.onDownloadProgress?.(percentage)
            this.#updateMessageData.percent = percentage
            this.#updateMessageData.total = total
            this.#updateMessageData.status = 'downloading'
            this.sendSuccessMessage()
          },
        })
        await fileExists(dirname(this.webZipPath), true)

        const writer = createWriteStream(this.webZipPath)
        const { promise, resolve, reject } = Promise.withResolvers<void>()

        response.data.pipe(writer)
        writer.on('finish', async () => {
          writer.close()
          this.remoteVersionInfo = remoteVersionInfo
          this.#updateMessageData.percent = 100
          this.#updateMessageData.status = 'downloaded'
          this.sendSuccessMessage()
          await options?.onDownloadComplete?.()?.catch?.(() => { })
          resolve()
        })
        writer.on('error', reject)

        await promise
        console.log('[WebUpdater] downloaded')
      }
    }
    catch (error) {
      console.error('[WebUpdater] checkForUpdates error', error)
    }
    finally {
      this.isInProgress = false
    }
    console.log('[WebUpdater] checkForUpdates end')
  }

  /** 解压 web 资源包 */
  async extract() {
    console.log('[WebUpdater] extract start')
    const extractDir = await fileOperations.executeTask('decompress', {
      src: this.webZipPath,
      dest: appConfig.webDir,
    }).finally(() => {
      this.remoteVersionInfo = null
    })
    console.log('extractPlugin dir', extractDir)
  }

  async upgradeNow() {
    if (this.remoteVersionInfo) {
      await this.extract()
      store.isExternalWeb = await fileExists(join(appConfig.webDir, 'dashboard.html'))
      getMainWindow()?.reload()
      await updateMainWindowPageTitle()
    }
  }

  private sendSuccessMessage() {
    ipcMain.send('app:resource-update', this.#updateMessageData)
  }

  private sendErrorMessage() {
    this.#updateMessageData.status = 'failed'
    ipcMain.send('app:resource-update', this.#updateMessageData)
  }
}()
