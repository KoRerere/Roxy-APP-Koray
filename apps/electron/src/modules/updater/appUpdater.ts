import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import type { CheckForUpdatesOptions } from '/@/modules/updater/webUpdater'
import type { DebUpdater } from 'electron-updater'
import { compare } from 'compare-versions'
import { app } from 'electron'
import electronUpdater from 'electron-updater'
import { join } from 'node:path'
import { API } from '/@/api'
import { osConfig } from '/@/constants'
import { isPackaged } from '/@/constants/common'
import { getMainWindow } from '/@/modules/app/mainWindow'
import { ipcSender } from '/@/modules/ipc/sender'
import { forceSaveConfig, store } from '/@/modules/store'
import { CustomDebUpdater } from './CustomDebUpdater'

const isDevelopment = !app.isPackaged

export const appUpdater = new class AppUpdater {
  /** 是否在下载中 */
  isInProgress = false
  /** 检查升级配置 */
  checkForUpdatesOptions?: CheckForUpdatesOptions
  /** 是否由 autoUpdater.quitAndInstal() 退出应用程序 */
  isQuittingForUpdate = false
  #autoUpdater: DebUpdater | typeof electronUpdater.autoUpdater = process.platform === 'linux'
    ? new CustomDebUpdater()
    : electronUpdater.autoUpdater

  /** 是否已初始化事件监听 */
  #isInitialized = false
  /** 更新信息消息体 */
  #updateMessageData: ResourceUpdateMessage = {
    type: 'app',
    percent: 0,
    description: '',
  }

  /** 等待下载 */
  downloadPromiser: PromiseWithResolvers<void> | null = null
  quitAndInstallPromiser: PromiseWithResolvers<void> | null = null

  constructor() { }

  async init(waitForDownload = false, options?: CheckForUpdatesOptions) {
    this.downloadPromiser = Promise.withResolvers<void>()
    this.checkForUpdatesOptions = options
    const result = await API.base.getAppUpgradeCreate(osConfig)

    console.debug(`user_get_app_upgrade result`, result)

    if (result.code !== 0 || !result.data) {
      console.log(`Update data is empty, skipping update`)
      return result
    }

    const { downloadUrl, version, upgradeContent, upgradeTitle, releaseTime, newFeatureTips = [] } = result.data
    this.#updateMessageData.originUpgradeData = result.data
    this.#updateMessageData.upgradeContent = upgradeContent
    this.#updateMessageData.title = upgradeTitle || 'RoxyBrowser'
    this.#updateMessageData.version = version
    this.#updateMessageData.currentVersion = app.getVersion()
    this.#updateMessageData.releaseTime = releaseTime
    this.#updateMessageData.newFeatureTips = newFeatureTips
    // downloadUrl = `http://localhost:7788/static`
    console.debug(`AppUpdater downloadUrl`, downloadUrl)

    if (!downloadUrl) {
      console.log(`Update URL is empty, skipping update`)
      return result
    }
    const publishOptions = {
      requestHeaders: {},
      provider: 'generic',
      url: downloadUrl,
    }

    console.debug(`autoUpdater options`, publishOptions)

    // 设置更新源
    this.#autoUpdater.setFeedURL(publishOptions)

    // 如果已经初始化过，只需要重新检查更新
    if (this.#isInitialized) {
      console.log('APP remote version:', version)
      console.log('APP local version:', app.getVersion())
      console.log('Is remote version greater than local version:', compare(version, app.getVersion(), '>'))
      // 远程版本发生变化，重新检查更新
      if (version && compare(version, app.getVersion(), '>')) {
        await this.checkForUpdates()
      }
      return waitForDownload ? this.downloadPromiser?.promise : result
    }

    // 首次初始化，设置配置和事件监听
    this.#isInitialized = true

    // 防止报错no such file or directory dev-app-update.yml
    if (isDevelopment) {
      this.#autoUpdater.forceDevUpdateConfig = true
      this.#autoUpdater.updateConfigPath = join(import.meta.dirname, '../dev-app-update.yml')
    }

    this.#autoUpdater.autoInstallOnAppQuit = true

    this.#autoUpdater.on(`error`, (error) => {
      console.error(`autoUpdater error occurred`, error)
      this.isInProgress = false

      if (this.#updateMessageData.version && compare(this.#updateMessageData.version, app.getVersion(), '>')) {
        const ignoreList = ['.blockmap', 'com.github.Electron', 'disableWebInstaller is set to false']
        if (ignoreList.every(n => !error.message.includes(n))) {
          this.sendErrorMessage()
        }
      }

      this.downloadPromiser?.reject(error)
    })

    this.#autoUpdater.on(`checking-for-update`, () => {
      console.log(`autoUpdater checking for updates`)
    })

    this.#autoUpdater.on('update-available', (updateInfo) => {
      this.isInProgress = true
      console.log(`Update available`, updateInfo)
    })

    // 更新下载完成
    this.#autoUpdater.on('update-downloaded', (event) => {
      this.isInProgress = false
      console.log(`Update download completed`, event)
      this.#updateMessageData.percent = 100
      this.#updateMessageData.status = 'downloaded'
      this.sendSuccessMessage()
      this.downloadPromiser?.resolve()
      store.showNewFeatureTips = Boolean(this.#updateMessageData.newFeatureTips?.[store.language]?.length)
      forceSaveConfig()
    })

    this.#autoUpdater.on(`update-not-available`, (updateInfo) => {
      this.isInProgress = false
      console.log(`No update available`, updateInfo)
      this.downloadPromiser?.resolve()
    })

    this.#autoUpdater.on(`download-progress`, (progressInfo) => {
      this.isInProgress = true
      const { percent, total } = progressInfo
      this.checkForUpdatesOptions?.onDownloadProgress?.(Math.floor(percent))
      console.log(`Update progress:`, percent)
      this.#updateMessageData.status = 'downloading'
      this.#updateMessageData.percent = percent
      this.#updateMessageData.total = total
      // {
      //     total: 366305518,
      //     delta: 6021615,
      //     transferred: 366305518,
      //     percent: 100,
      //     bytesPerSecond: 13831723
      //   }
      getMainWindow()?.setProgressBar(percent / 100)
      this.sendSuccessMessage()
    })

    this.checkForUpdates()
    return waitForDownload ? this.downloadPromiser?.promise : result
  }

  async checkForUpdates() {
    console.info(`Checking for updates checkAppUpdate`, this.isInProgress)

    if (this.isInProgress) {
      return
    }

    if (!this.#isInitialized) {
      console.warn('autoUpdater not initialized yet')
      this.init()
      return
    }

    this.isInProgress = true
    const checkResult = await this.#autoUpdater.checkForUpdates().catch((error) => {
      console.log(`checkForUpdates error`, error)
    }).finally(() => {
      this.isInProgress = false
    })

    console.log(`checkResult`, checkResult)
    return this.#updateMessageData
  }

  /** 获取更新内容 */
  getUpdateMessageData() {
    return this.#updateMessageData
  }

  async getLastUpdateFeature() {
    const { code, data } = await API.base.getAppUpgradeCreate(osConfig)
    if (code !== 0 || !data) {
      return []
    }
    return data.newFeatureTips[store.language]?.[0]?.content ? data.newFeatureTips[store.language] : []
  }

  /** 是否有更新 */
  async hasUpdate() {
    const { data } = await API.base.userGetAppUpgradeCreate(osConfig)
    const { version } = data
    console.log(`Remote version`, version, `Local version`, app.getVersion())
    return Boolean(version) && compare(version, app.getVersion(), '>')
  }

  /** 立即退出应用并且更新 */
  async upgradeNow() {
    // autoUpdater.quitAndInstall();
    console.info(`Quitting app and updating immediately`)
    if (isPackaged) {
      if (this.downloadPromiser?.promise) {
        this.downloadPromiser.promise.finally(() => {
          this.quitAndInstall()
        })
      }
      else {
        this.quitAndInstall()
      }
    }
  }

  quitAndInstall() {
    this.quitAndInstallPromiser = Promise.withResolvers<void>()
    this.isQuittingForUpdate = true
    this.#autoUpdater.quitAndInstall(true, true)
    // return this.quitAndInstallPromiser.promise
  }

  private sendSuccessMessage() {
    ipcSender.app.resourceUpdate(this.#updateMessageData)
  }

  private sendErrorMessage() {
    this.#updateMessageData.status = 'failed'
    ipcSender.app.resourceUpdate(this.#updateMessageData)
  }
}()
