import type { UserGetAppUpgradeCreateData } from '@roxy/backend-api'
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { compare } from 'compare-versions'
import { app } from 'electron'
import { MacUpdater, NsisUpdater } from 'electron-updater'
import { join } from 'node:path'
import { API } from '/@/api'
import { osConfig } from '/@/constants'
import { getMainWindow } from '/@/modules/app/mainWindow'
import { ipcMain } from '/@/modules/ipc'
import { isMac, isPackaged } from '/@/utils'
import { CheckForUpdatesOptions } from '/@/modules/updater/webUpdater'
import { forceSaveConfig, store } from '/@/modules/store'

export type { UpdateInfo } from 'electron-updater'

const isDevelopment = !app.isPackaged

export const appUpdater = new class AppUpdater {
  /** 是否在下载中 */
  isInProgress = false
  /** 检查升级配置 */
  checkForUpdatesOptions?: CheckForUpdatesOptions
  /** 是否由 autoUpdater.quitAndInstal() 退出应用程序 */
  isQuittingForUpdate = false
  #autoUpdater!: MacUpdater | NsisUpdater
  /** 更新信息消息体 */
  #updateMessageData: ResourceUpdateMessage = {
    type: 'app',
    percent: 0,
    description: '',
  }
  /** 等待下载 */
  downloadPromiser: PromiseWithResolvers<void> | null = null

  constructor() { }

  async init(waitForDownload = false, options?: CheckForUpdatesOptions) {
    this.downloadPromiser = Promise.withResolvers<void>()
    this.checkForUpdatesOptions = options
    const result = await API.base.getAppUpgradeCreate(osConfig)

    console.debug(`user_get_app_upgrade result`, result)

    if (result.code !== 0 || !result.data) {
      console.log(`更新数据为空 跳出更新`)
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
      console.log(`更新地址为空 跳出更新`)
      return result
    }
    const publishOptions = {
      requestHeaders: {},
      provider: 'generic',
      url: downloadUrl,
    }

    console.debug(`autoUpdater options`, publishOptions)

    if (this.#autoUpdater) {
      // 动态更新autoUpdater的配置
      this.#autoUpdater.setFeedURL(publishOptions)
      console.log('APP 远程版本：', version)
      console.log('APP 本地版本：', app.getVersion())
      console.log('远程版本是否大于本地版本：', compare(version, app.getVersion(), '>'))
      // 远程版本发生变化，重新检查更新
      if (version && compare(version, app.getVersion(), '>')) {
        await this.checkForUpdates()
      }
      return waitForDownload ? this.downloadPromiser?.promise : result
    }

    this.#autoUpdater = isMac ? new MacUpdater(publishOptions) : new NsisUpdater(publishOptions)

    // 防止报错no such file or directory dev-app-update.yml
    if (isDevelopment) {
      this.#autoUpdater.forceDevUpdateConfig = true
      this.#autoUpdater.updateConfigPath = join(__dirname, '../dev-app-update.yml')
    }

    this.#autoUpdater.autoInstallOnAppQuit = true

    this.#autoUpdater.on(`error`, (error) => {
      this.isInProgress = false

      if (this.#updateMessageData.version && compare(this.#updateMessageData.version, app.getVersion(), '>')) {
        const ignoreList = ['.blockmap', 'com.github.Electron', 'disableWebInstaller is set to false']
        if (ignoreList.every(n => !error.message.includes(n))) {
          this.sendErrorMessage()
        }
      }

      this.downloadPromiser?.reject(error)
      console.error(`autoUpdater 出现错误`, error)
    })

    this.#autoUpdater.on(`checking-for-update`, () => {
      console.log(`autoUpdater 检查更新`)
    })

    this.#autoUpdater.on('update-available', (updateInfo) => {
      this.isInProgress = true
      console.log(`有更新`, updateInfo)
    })

    // 更新下载完成
    this.#autoUpdater.on('update-downloaded', (event) => {
      this.isInProgress = false
      console.log(`更新下载完成`, event)
      this.#updateMessageData.percent = 100
      this.#updateMessageData.status = 'downloaded'
      this.sendSuccessMessage()
      this.downloadPromiser?.resolve()
      store.showNewFeatureTips = Boolean(this.#updateMessageData.newFeatureTips?.[store.language]?.length)
      forceSaveConfig()
    })

    this.#autoUpdater.on(`update-not-available`, (updateInfo) => {
      this.isInProgress = false
      console.log(`当前无更新`, updateInfo)
      this.downloadPromiser?.resolve()
    })

    this.#autoUpdater.on(`download-progress`, (progressInfo) => {
      this.isInProgress = true
      const { percent, total } = progressInfo
      this.checkForUpdatesOptions?.onDownloadProgress?.(Math.floor(percent))
      console.log(`更新进度: `, percent)
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
    console.info(`检查更新 checkAppUpdate`, this.isInProgress)

    if (this.isInProgress) {
      return
    }

    if (!this.#autoUpdater) {
      // await this.init()
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

  /** 是否有更新 */
  async hasUpdate() {
    const { data } = await API.base.userGetAppUpgradeCreate(osConfig)
    const { version } = data
    console.log(`远程版本`, version, `本地版本`, app.getVersion())
    return Boolean(version) && compare(version, app.getVersion(), '>')
  }

  /** 立即退出应用并且更新 */
  upgradeNow() {
    // autoUpdater.quitAndInstall();
    console.info(`立即退出应用并且更新`)
    if (isPackaged) {
      this.isQuittingForUpdate = true
      this.#autoUpdater.quitAndInstall(true, true)
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
