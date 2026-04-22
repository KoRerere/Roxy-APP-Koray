import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import axios from 'axios'
import { compare } from 'compare-versions'
import { app } from 'electron'
import { createWriteStream } from 'node:fs'
import { rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { getWebDomain } from '/@/api/util'
import { appConfig } from '/@/constants'
import { getLocalWebVersion, getMainWindow, updateMainWindowPageTitle } from '/@/modules/app/mainWindow'
import { fileOperations } from '/@/modules/fileOperations'
import { ipcSender } from '/@/modules/ipc/sender'
import { store } from '/@/modules/store'
import { fileExists, getErrorMessage } from '/@/utils'

interface VersionInfo {
  /** 最新版本号 */
  version: string
  /** 最低支持版本号 */
  minimum_app_version: string
  /** 发布时间 */
  releaseTime: string
}

export interface CheckForUpdatesOptions {
  onDownloadProgress?: (percentage: number) => void
  onDownloadComplete?: () => any
}

export const webUpdater = new class WebUpdater {
  timer: NodeJS.Timeout | null = null
  /** web 资源包下载地址 */
  webDomain = ''
  /** web zip 资源包路径 */
  webZipPath = join(appConfig.tempDir, 'web.zip')
  /** 是否正在解压中 */
  extractPromiser: PromiseWithResolvers<void> | null = null
  /** 临时解压目录 */
  tempExtractDir = join(appConfig.sessionDir, 'web_extract')
  /** 临时解压目录，解压成功后标记文件 */
  tempExtractSuccessFlagFile = join(this.tempExtractDir, 'web_extract_success.flag')
  /** 解压成功标记文件 */
  extractSuccessFlagFile = join(appConfig.externalWebDir, 'web_extract_success.flag')
  /** 是否在下载中 */
  isInProgress = false
  /** 是否正在升级中 */
  isUpgrading = false
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
    return `${this.webDomain}/public/package/web/${app.getVersion()}/version.json`
  }

  /** 活动信息文件地址 */
  get activityUrl() {
    return `${this.webDomain}/public/package/web/${app.getVersion()}/activity.json`
  }

  /** web 资源包下载地址 */
  get downloadUrl() {
    return `${this.webDomain}/public/package/web/${app.getVersion()}/dist.zip`
  }

  constructor() {
    this.startInterval()
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

    this.isInProgress = true
    console.log('[WebUpdater] checkForUpdates start')
    try {
      this.webDomain = await getWebDomain(false)
      // 获取远程版本信息
      const remoteVersionInfo = await axios.get<VersionInfo>(this.versionUrl, { timeout: 3 * 1000 }).then(response => response.data)
      console.log('[WebUpdater] remoteVersionInfo', remoteVersionInfo)

      if (this.remoteVersionInfo && compare(this.remoteVersionInfo.version, remoteVersionInfo.version, '>=')) {
        this.sendSuccessMessage()
        this.isInProgress = false
        console.log('[WebUpdater] checkForUpdates already downloaded')
        return
      }

      // 检查 app 版本是否过低
      if (compare(remoteVersionInfo.minimum_app_version, app.getVersion(), '>')) {
        console.log('[WebUpdater] app version is too old')
        this.isInProgress = false
        return
      }
      // 获取本地版本信息
      const localVersion = await getLocalWebVersion()
      console.log('[WebUpdater] localVersion', localVersion)
      console.log('[WebUpdater] remoteVersion', remoteVersionInfo.version)
      // 检查是否需要更新
      if (compare(remoteVersionInfo.version, localVersion, '>')) {
        this.#updateMessageData.originUpgradeData = remoteVersionInfo
        this.#updateMessageData.version = remoteVersionInfo.version
        this.#updateMessageData.releaseTime = remoteVersionInfo.releaseTime
        this.#updateMessageData.currentVersion = localVersion
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

          await axios.get<Record<string, any>>(this.activityUrl).then(response => response.data).then((result) => {
            this.#updateMessageData.newFeatureTips = {
              activityInfo: result.activityInfo,
              isActivity: result.activityInfo.isActivity,
            }
          }).catch(() => { })

          this.sendSuccessMessage()
          // 下载完成，自动解压
          this.extractToPending()
          await options?.onDownloadComplete?.()?.catch?.(() => { })
          resolve()
        })
        writer.on('error', (error) => {
          this.remoteVersionInfo = null
          reject(error)
        })

        await promise
        console.log('[WebUpdater] downloaded')
      }
    }
    catch (error) {
      console.error('[WebUpdater] checkForUpdates error', getErrorMessage(error))
    }
    finally {
      this.isInProgress = false
    }
    console.log('[WebUpdater] checkForUpdates end')
  }

  /** 解压 web 资源包 */
  async extractToPending() {
    console.log('[WebUpdater] extract start')
    if (this.extractPromiser) {
      console.log('[WebUpdater] extract already in progress')
      return this.extractPromiser.promise
    }
    this.extractPromiser = Promise.withResolvers<void>()

    const timer = setTimeout(() => {
      console.warn('[WebUpdater] extract timeout')
      this.extractPromiser?.resolve()
      this.extractPromiser = null
    }, 15 * 1000)

    try {
      const extractDir = await fileOperations.executeTask('decompress', {
        src: this.webZipPath,
        dest: this.tempExtractDir,
      })
      await writeFile(this.tempExtractSuccessFlagFile, 'true', 'utf-8')
      console.log('extractPlugin dir', extractDir)
    }
    catch (error) {
      console.error('[WebUpdater] extract error', error)
    }
    finally {
      clearTimeout(timer)
      this.extractPromiser?.resolve()
      this.extractPromiser = null
      console.log('[WebUpdater] extract end')
    }
  }

  async extract() {
    await this.extractPromiser?.promise

    const isExtractSuccess = await fileExists(this.tempExtractSuccessFlagFile)
    if (!isExtractSuccess) {
      console.error('[WebUpdater] extract failed, success flag file not found')
      throw new Error('Web extract failed')
    }

    const bakDir = join(appConfig.sessionDir, `web-bak`)
    await rename(appConfig.externalWebDir, bakDir).catch((error) => {
      console.warn('[WebUpdater] extract rename to bakDir failed, maybe first time update', error)
      return Promise.resolve()
    })
    await rename(this.tempExtractDir, appConfig.externalWebDir).catch((error) => {
      console.error('[WebUpdater] extract rename error', error)
      store.isExternalWeb = false
    })
    rm(bakDir, { recursive: true, force: true })
    this.remoteVersionInfo = null
  }

  async upgradeNow() {
    console.debug('[WebUpdater] upgradeNow start', this.remoteVersionInfo?.version, this.isUpgrading)
    if (this.remoteVersionInfo && !this.isUpgrading) {
      this.isUpgrading = true
      try {
        await this.extract()
        store.isExternalWeb = await fileExists(this.extractSuccessFlagFile)
        console.debug('[WebUpdater] upgradeNow store.isExternalWeb', store.isExternalWeb)
        getMainWindow()?.reload()
        await updateMainWindowPageTitle()
        return true
      }
      catch (error) {
        console.error('[WebUpdater] upgradeNow error', error)
      }
      finally {
        this.isUpgrading = false
      }
      return true
    }
    return false
  }

  private sendSuccessMessage() {
    ipcSender.app.resourceUpdate(this.#updateMessageData)
  }

  private sendErrorMessage() {
    this.#updateMessageData.status = 'failed'
    ipcSender.app.resourceUpdate(this.#updateMessageData)
  }
}()
