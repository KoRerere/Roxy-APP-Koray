import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import type { CheckForUpdatesOptions } from '/@/modules/updater/webUpdater'
import type { DebUpdater } from 'electron-updater'
import { compare } from 'compare-versions'
import { app } from 'electron'
import log from 'electron-log/main'
import electronUpdater from 'electron-updater'
import { join } from 'node:path'
// import { setTimeout } from 'node:timers/promises'
import { API } from '/@/api'
import { osConfig } from '/@/constants'
import { isPackaged } from '/@/constants/common'
import { getMainWindow } from '/@/modules/app/mainWindow'
import { resetBrowserDataSyncedBeforeQuit, syncBrowserDataBeforeQuit } from '/@/modules/app/quitCleanup'
import { browserManager } from '/@/modules/browser'
import { getAppIdleState } from '/@/modules/ipc/receiver/modules/app'
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
  /** 是否正在执行升级退出流程 (含数据同步) */
  private upgradeInProgress = false
  /** electron-updater 实际已下载完成的版本，与 #updateMessageData.version 解耦，避免 init 提前刷新远端版本后误判无需重下 */
  #downloadedVersion?: string
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

  quitAndInstallPromiser: PromiseWithResolvers<void> | null = null

  constructor() {
    const appUpdaterLogger = log.create({ logId: 'app-updater' })
    appUpdaterLogger.transports.file.level = 'debug'
    appUpdaterLogger.transports.file.fileName = 'app-updater.log'
    this.#autoUpdater.logger = appUpdaterLogger

    setInterval(() => {
      this.init()
    }, 10 * 1000 * 60)
  }

  async init() {
    const result = await API.base.getAppUpgradeCreate(osConfig)

    console.debug(`user_get_app_upgrade result`, result)

    if (result.code !== 0 || !result.data) {
      console.log(`Update data is empty, skipping update`)
      return result
    }

    const { downloadUrl, version, upgradeContent, upgradeTitle, releaseTime, newFeatureTips } = result.data
    this.#updateMessageData.originUpgradeData = structuredClone(result.data)
    this.#updateMessageData.upgradeContent = upgradeContent
    this.#updateMessageData.title = upgradeTitle || 'RoxyBrowser'
    this.#updateMessageData.version = version
    this.#updateMessageData.currentVersion = app.getVersion()
    this.#updateMessageData.releaseTime = releaseTime
    this.#updateMessageData.newFeatureTips = structuredClone(newFeatureTips ?? {})
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
        await this.checkForUpdates(version)
      }
      return result
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

      if (this.#updateMessageData.status === 'downloaded') {
        // 安装阶段失败：重置状态，允许下次重新下载并安装，同时通知用户
        this.#updateMessageData.status = undefined
        this.#downloadedVersion = undefined
        this.upgradeInProgress = false
        this.isQuittingForUpdate = false
        this.sendErrorMessage()
        return
      }

      if (this.#updateMessageData.version && compare(this.#updateMessageData.version, app.getVersion(), '>')) {
        const ignoreList = ['.blockmap', 'com.github.Electron', 'disableWebInstaller is set to false']
        if (ignoreList.every(n => !error.message.includes(n))) {
          this.sendErrorMessage()
        }
      }
    })

    this.#autoUpdater.on(`checking-for-update`, () => {
      console.log(`autoUpdater checking for updates`)
    })

    this.#autoUpdater.on('update-available', (updateInfo) => {
      this.isInProgress = true
      console.log(`Update available`, updateInfo)
      // autoDownload 默认开启，electron-updater 会自动下载，无需在此处理
    })

    // 更新下载完成
    this.#autoUpdater.on('update-downloaded', (event) => {
      this.isInProgress = false
      console.log(`Update download completed`, event)
      this.#downloadedVersion = event.version
      this.#updateMessageData.percent = 100
      this.#updateMessageData.status = 'downloaded'
      this.sendSuccessMessage()
      store.showNewFeatureTips = Boolean(this.#updateMessageData.newFeatureTips?.[store.language]?.length)
      forceSaveConfig()

      // 安转包下载完成后，20 秒后检查是否为空闲状态，如果为空闲状态，则自动更新
      setTimeout(() => {
        this.installUpdateWhenIdle()
      }, 20 * 1000)
    })

    this.#autoUpdater.on(`update-not-available`, (updateInfo) => {
      this.isInProgress = false
      console.log(`No update available`, updateInfo)
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
    return result
  }

  async checkForUpdates(remoteVersion?: string) {
    console.info(`Checking for updates checkAppUpdate`, this.isInProgress)

    if (this.isInProgress) {
      return
    }

    if (!this.#isInitialized) {
      console.warn('autoUpdater not initialized yet')
      this.init()
      return
    }

    // 更新已下载完成，等待安装中
    if (this.#updateMessageData.status === 'downloaded') {
      const targetVersion = remoteVersion ?? this.#updateMessageData.version
      const downloadedVersion = this.#downloadedVersion
      // 远端目标版本高于本地 pending 包时，必须重下；不能拿 #updateMessageData.version 比较，init 会先把它刷成最新远端版本
      if (targetVersion && downloadedVersion && compare(targetVersion, downloadedVersion, '>')) {
        console.log(`[AppUpdater] Newer version ${targetVersion} available, downloaded ${downloadedVersion}, reset and re-download`)
        this.#updateMessageData.status = undefined
        this.#downloadedVersion = undefined
        this.#updateMessageData.percent = 0
      }
      else {
        // 已是最新版本，通知前端并跳过，避免重复调用干扰 Squirrel.Mac 安装流程
        this.sendSuccessMessage()
        return this.#updateMessageData
      }
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
    if (!isDevelopment) {
      return this.#updateMessageData
    }

    const { code, data } = await API.base.getAppUpgradeCreate(osConfig)
    if (code !== 0 || !data) {
      return {}
    }
    return data
  }

  /** 是否有更新 */
  async hasUpdate() {
    const { data } = await API.base.userGetAppUpgradeCreate(osConfig)
    const { version } = data
    console.log(`Remote version`, version, `Local version`, app.getVersion())
    return Boolean(version) && compare(version, app.getVersion(), '>')
  }

  /** 立即退出应用并且更新 (先同步用户数据, 再触发安装) */
  async upgradeNow() {
    if (this.upgradeInProgress) {
      console.log('upgradeNow already in progress, skipping duplicate call')
      return
    }

    const { version, status } = this.#updateMessageData
    if (status === 'downloaded' && version && this.#downloadedVersion && version !== this.#downloadedVersion) {
      console.log(`[AppUpdater] Pending package is ${this.#downloadedVersion}, target is ${version}, re-check before install`)
      await this.checkForUpdates(version)
      return
    }

    this.upgradeInProgress = true
    this.isQuittingForUpdate = true

    console.info('Preparing to quit and update: syncing browser data first')

    try {
      await syncBrowserDataBeforeQuit()
      store.appNormalExit = true
      // 不待候 forceSaveConfig 完成，直接进入 quitAndInstall。
      // 背景：macOS Intel 上磁盘 IO 较慢，若 await forceSaveConfig 期间
      // before-quit 快捷路径未调用 event.preventDefault() 就放行 quit，
      // 会导致进程在 quitAndInstall 调用前就退出，ShipIt 只收到 InstallOnly。
      // 改为 fire-and-forget：先确保 Squirrel 收到 InstallAndRelaunch 指令，配置市异步保存。
      forceSaveConfig()
      console.info('Browser data synced, quitting app and updating immediately')

      if (isPackaged) {
        await this.quitAndInstall()
      }
    }
    catch (error) {
      console.error('upgradeNow failed:', error)
      this.upgradeInProgress = false
      this.isQuittingForUpdate = false
      resetBrowserDataSyncedBeforeQuit()
      throw error
    }
  }

  async quitAndInstall() {
    this.quitAndInstallPromiser = Promise.withResolvers<void>()
    this.isQuittingForUpdate = true

    // isSilent=false: 让真实 NSIS 安装器以非静默方式运行并显示安装进度（仅对 Windows 生效）
    this.#autoUpdater.quitAndInstall(false, true)
    // return this.quitAndInstallPromiser.promise
  }

  /** 当 APP 处于空闲状态时，安装更新 */
  async installUpdateWhenIdle() {
    if (!store.autoUpdateApp || !getAppIdleState()) {
      return
    }

    const { version, status } = this.#updateMessageData
    const { openedBrowserList, openingBrowserMap } = browserManager

    // pending 包版本须与展示的目标版本一致，避免远端已升到 8.7.2 但 pending 仍是 8.7.1 时被空闲自动升级
    const packageMatchesTarget = !version || !this.#downloadedVersion || version === this.#downloadedVersion
    if (status === 'downloaded' && version && this.#downloadedVersion && !packageMatchesTarget) {
      console.log(`[AppUpdater] Idle install skipped: pending ${this.#downloadedVersion}, target ${version}, re-check`)
      await this.checkForUpdates(version)
      return
    }

    const newVersionIsReadyToUpgrade = this.#downloadedVersion && status === 'downloaded'
      && compare(this.#downloadedVersion, app.getVersion(), '>') && packageMatchesTarget
    // 无处于打开状态的窗口
    const allBrowsersClosed = openedBrowserList.length === 0 && openingBrowserMap.size === 0
    // 如果 APP 当前为空闲状态，则检查是否需要更新
    if (newVersionIsReadyToUpgrade && allBrowsersClosed) {
      console.log('installUpdateWhenIdle, upgrade now')
      this.upgradeNow()
    }
  }

  private sendSuccessMessage() {
    ipcSender.app.resourceUpdate(this.#updateMessageData)
  }

  private sendErrorMessage() {
    this.#updateMessageData.status = 'failed'
    ipcSender.app.resourceUpdate(this.#updateMessageData)
  }
}()
