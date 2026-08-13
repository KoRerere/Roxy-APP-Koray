import type { PendingUpdateCache } from './pendingUpdateProbe'
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
import { isPackaged, isWindows } from '/@/constants/common'
import { getMainWindow } from '/@/modules/app/mainWindow'
import { resetBrowserDataSyncedBeforeQuit, syncBrowserDataBeforeQuit } from '/@/modules/app/quitCleanup'
import { isPostUpdateLaunch, isSkipPendingUpdateLaunch } from '/@/modules/app/relaunch'
import { browserManager } from '/@/modules/browser'
import { getAppIdleState } from '/@/modules/ipc/receiver/modules/app'
import { ipcSender } from '/@/modules/ipc/sender'
import { forceSaveConfig, store } from '/@/modules/store'
import { getAutoUpdateAppOnLaunch } from '/@/modules/store/autoUpdateApp'
import { buildAppUpdateFeedUrl, resolveAppGatewayBaseUrl } from './buildAppUpdateFeedUrl'
import { CustomDebUpdater } from './CustomDebUpdater'
import { probeLocalPendingUpdate } from './pendingUpdateProbe'
import { buildAppUpdatePublishOptions } from './PreservingGenericProvider'

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
  /** 当前会话最近一次 setFeedURL 的地址，供下载完成后写入本地 pending 标记 */
  #pendingFeedUrl?: string
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

    console.debug(`get_app_upgrade result`, result)

    if (result.code !== 0 || !result.data) {
      console.log(`Update data is empty, skipping update`)
      return result
    }

    const { version, upgradeContent, upgradeTitle, releaseTime, newFeatureTips } = result.data
    this.#updateMessageData.originUpgradeData = structuredClone(result.data)
    this.#updateMessageData.upgradeContent = upgradeContent
    this.#updateMessageData.title = upgradeTitle || 'RoxyBrowser'
    this.#updateMessageData.version = version
    this.#updateMessageData.currentVersion = app.getVersion()
    this.#updateMessageData.releaseTime = releaseTime
    this.#updateMessageData.newFeatureTips = structuredClone(newFeatureTips ?? {})
    // 远端 forceUpgrade 变化时同步退出安装开关（已初始化场景也会走到这里）
    if (this.#isInitialized) {
      this.#syncAutoInstallOnAppQuit()
    }

    const baseUrl = await resolveAppGatewayBaseUrl()
    if (!baseUrl) {
      console.log(`App gateway baseUrl is empty, skipping update`)
      return result
    }

    const feedUrl = buildAppUpdateFeedUrl(baseUrl, osConfig)
    console.debug(`AppUpdater feedUrl`, feedUrl)

    await this.#ensureUpdaterDirectNetwork()

    const publishOptions = buildAppUpdatePublishOptions(feedUrl)

    console.debug(`autoUpdater options`, publishOptions)

    // 设置更新源
    this.#pendingFeedUrl = feedUrl
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
    this.#ensureUpdaterEventListeners()
    this.checkForUpdates()
    return result
  }

  /** 冷启动：本地探测待安装包，命中则安装并跳过其余启动流程（仅 Windows） */
  async tryInstallPendingUpdateOnLaunch(): Promise<boolean> {
    if (!isWindows || !isPackaged) {
      return false
    }

    if (isPostUpdateLaunch()) {
      console.log('[AppUpdater] Post-install launch, clear pending marker and skip cold-start install')
      this.#clearPendingAppUpdateMarker()
      return false
    }

    if (isSkipPendingUpdateLaunch()) {
      console.log('[AppUpdater] Skip pending update install on relaunch')
      return false
    }

    const pendingVersion = store.pendingAppUpdateVersion
    if (!pendingVersion) {
      return false
    }

    if (!compare(pendingVersion, app.getVersion(), '>')) {
      this.#clearPendingAppUpdateMarker()
      return false
    }

    // 用户关闭自动更新时，仅 forceUpgrade 待装包仍强制安装
    if (!getAutoUpdateAppOnLaunch()) {
      if (!store.pendingAppUpdateForceUpgrade) {
        return false
      }
      console.log('[AppUpdater] forceUpgrade pending, install despite autoUpdateAppOnLaunch=false')
    }

    const cache = await probeLocalPendingUpdate(pendingVersion)
    if (!cache) {
      console.log('[AppUpdater] Local pending cache missing, clear marker and continue startup')
      this.#clearPendingAppUpdateMarker()
      return false
    }

    try {
      this.#ensureUpdaterEventListeners()
      await this.#ensureUpdaterDirectNetwork()
      if (store.pendingAppUpdateFeedUrl) {
        this.#autoUpdater.setFeedURL(buildAppUpdatePublishOptions(store.pendingAppUpdateFeedUrl))
      }
      this.#hydrateDownloadedUpdateFromCache(cache)
      this.#downloadedVersion = cache.version
      this.#updateMessageData.status = 'downloaded'
      this.#updateMessageData.version = cache.version
      this.#updateMessageData.percent = 100

      await this.upgradeNow()
      return true
    }
    catch (error) {
      console.error('[AppUpdater] Launch-time install failed, continue normal startup:', error)
      this.upgradeInProgress = false
      this.isQuittingForUpdate = false
      return false
    }
  }

  #clearPendingAppUpdateMarker() {
    store.pendingAppUpdateVersion = undefined
    store.pendingAppUpdateFeedUrl = undefined
    store.pendingAppUpdateForceUpgrade = undefined
    forceSaveConfig()
  }

  #markPendingAppUpdate(version: string) {
    if (!isWindows) {
      return
    }
    store.pendingAppUpdateVersion = version
    if (this.#pendingFeedUrl) {
      store.pendingAppUpdateFeedUrl = this.#pendingFeedUrl
    }
    // 与 pending 包同生命周期，供下次冷启动覆盖 autoUpdateAppOnLaunch
    store.pendingAppUpdateForceUpgrade = Boolean(this.#updateMessageData.originUpgradeData?.forceUpgrade)
    forceSaveConfig()
  }

  /** 当前是否处于强制升级（store 待装标记或本次会话升级载荷） */
  isForceUpgradePending(): boolean {
    return Boolean(store.pendingAppUpdateForceUpgrade)
      || Boolean(this.#updateMessageData.originUpgradeData?.forceUpgrade)
  }

  /** 是否应自动安装：用户开启自动更新，或服务端 forceUpgrade */
  shouldAutoInstallUpdate(): boolean {
    return getAutoUpdateAppOnLaunch() || this.isForceUpgradePending()
  }

  #syncAutoInstallOnAppQuit() {
    // Windows 走冷启动安装，退出时不交给 electron-updater；非 Windows 在自动更新或强制升级时退出安装
    this.#autoUpdater.autoInstallOnAppQuit = !isWindows && this.shouldAutoInstallUpdate()
  }

  /** electron-updater 使用独立 netSession，显式直连，不继承 defaultSession / 系统代理 */
  async #ensureUpdaterDirectNetwork() {
    await this.#autoUpdater.netSession.setProxy({ proxyRules: 'direct://' })
  }

  #ensureUpdaterEventListeners() {
    if (this.#isInitialized) {
      this.#syncAutoInstallOnAppQuit()
      return
    }

    this.#isInitialized = true

    // 预签名 OSS 无法走 blockmap 差分，禁用后可避免无效 403 重试
    if (process.platform !== 'linux') {
      this.#autoUpdater.disableDifferentialDownload = true
    }

    if (isDevelopment) {
      this.#autoUpdater.forceDevUpdateConfig = true
      this.#autoUpdater.updateConfigPath = join(import.meta.dirname, '../dev-app-update.yml')
    }

    this.#registerUpdaterEventListeners()
  }

  #hydrateDownloadedUpdateFromCache(cache: PendingUpdateCache) {
    const helper = {
      cacheDir: cache.cacheDir,
      cacheDirForPendingUpdate: join(cache.cacheDir, 'pending'),
      _file: cache.installerPath,
      _packageFile: null as string | null,
      _downloadedFileInfo: {
        fileName: cache.fileName,
        sha512: cache.sha512,
        isAdminRightsRequired: cache.isAdminRightsRequired,
      },
      get file() {
        return this._file
      },
      get downloadedFileInfo() {
        return this._downloadedFileInfo
      },
      get packageFile() {
        return this._packageFile
      },
    }

    ;(this.#autoUpdater as any).downloadedUpdateHelper = helper
  }

  #registerUpdaterEventListeners() {
    this.#syncAutoInstallOnAppQuit()

    this.#autoUpdater.on(`error`, (error) => {
      console.error(`autoUpdater error occurred`, error)
      this.isInProgress = false

      if (this.#updateMessageData.status === 'downloaded') {
        // 安装阶段失败：重置状态，允许下次重新下载并安装，同时通知用户
        this.#updateMessageData.status = undefined
        this.#downloadedVersion = undefined
        this.upgradeInProgress = false
        this.isQuittingForUpdate = false
        this.#clearPendingAppUpdateMarker()
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
      // 检查一结束 download 就会开始；立刻标成 downloading，避免 checkForUpdates 仍返回上次的 downloaded
      this.#updateMessageData.status = 'downloading'
      if (typeof this.#updateMessageData.percent !== 'number' || this.#updateMessageData.percent >= 100)
        this.#updateMessageData.percent = 0
      this.sendSuccessMessage()
    })

    // 更新下载完成
    this.#autoUpdater.on('update-downloaded', (event) => {
      this.isInProgress = false
      console.log(`Update download completed`, event)
      this.#downloadedVersion = event.version
      this.#updateMessageData.percent = 100
      this.#updateMessageData.status = 'downloaded'
      this.#markPendingAppUpdate(event.version)
      // forceUpgrade 可能刚写入，刷新退出时是否自动安装
      this.#syncAutoInstallOnAppQuit()
      this.sendSuccessMessage()
      // 登录前 tips 常为空；开关仅表示「安装后需按空间检查一次」，内容在登录后现拉
      store.showNewFeatureTips = true
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
  }

  async checkForUpdates(remoteVersion?: string) {
    console.info(`Checking for updates checkAppUpdate`, this.isInProgress)

    if (this.isInProgress) {
      return this.#updateMessageData
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
      // 下载仍在进行时不能清 isInProgress，否则后续 check 会把过期 downloaded 回给前端
      if (this.#updateMessageData.status !== 'downloading')
        this.isInProgress = false
    })

    console.log(`checkResult`, checkResult)
    return this.#updateMessageData
  }

  /** 获取更新内容 */
  getUpdateMessageData() {
    return this.#updateMessageData
  }

  /**
   * 登录后轻量刷新升级版本载荷（不含新特性 tips）
   * 不触碰 feed / checkForUpdates，避免干扰已在跑的更新检测
   */
  async refreshUpgradePayload() {
    const result = await API.base.getAppUpgradeCreate(osConfig)
    console.debug('[AppUpdater] refreshUpgradePayload result', result)

    if (result.code !== 0 || !result.data) {
      console.log('[AppUpdater] refreshUpgradePayload empty, skip')
      return result
    }

    const { version, upgradeContent, upgradeTitle, releaseTime } = result.data
    this.#updateMessageData.originUpgradeData = structuredClone(result.data)
    this.#updateMessageData.upgradeContent = upgradeContent
    this.#updateMessageData.title = upgradeTitle || 'RoxyBrowser'
    this.#updateMessageData.version = version
    this.#updateMessageData.currentVersion = app.getVersion()
    this.#updateMessageData.releaseTime = releaseTime
    this.#syncAutoInstallOnAppQuit()
    return result
  }

  /**
   * 按当前登录用户 / workspace 拉取新特性 tips（独立接口，与升级版本解耦）
   * 后端在返回时自行 ack，客户端无需再调 userAckFeatureTipsCreate
   */
  async fetchAppFeatureTips() {
    const result = await API.base.userGetAppFeatureTipsCreate(osConfig)
    console.debug('[AppUpdater] fetchAppFeatureTips result', result)
    return result
  }

  async getLastUpdateFeature() {
    const { code, data } = await API.base.userGetAppFeatureTipsCreate(osConfig)
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

  /**
   * 用户主动退出入口。
   * forceUpgrade 且安装包已下载时走 upgradeNow（自定义 before-quit 不会靠 autoInstallOnAppQuit 装上，
   * 且 Windows 退出时本就不开启 autoInstallOnAppQuit）。
   * 纯退出安装完成后不拉起 APP（relaunch: false）。
   */
  quitApp() {
    if (this.isForceUpgradePending() && this.#updateMessageData.status === 'downloaded') {
      console.log('[AppUpdater] forceUpgrade on quit, calling upgradeNow without relaunch')
      this.upgradeNow({ relaunch: false }).catch((error) => {
        console.error('[AppUpdater] upgradeNow on quit failed, fallback to app.quit:', error)
        app.quit()
      })
      return
    }
    app.quit()
  }

  /**
   * 立即退出应用并且更新 (先同步用户数据, 再触发安装)
   * @param options.relaunch 安装完成后是否重新打开 APP，默认 true；纯退出升级传 false
   */
  async upgradeNow(options?: { relaunch?: boolean }) {
    const relaunch = options?.relaunch ?? true
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

    console.info('Preparing to quit and update: syncing browser data first', { relaunch })

    try {
      await syncBrowserDataBeforeQuit()
      store.appNormalExit = true
      // 不待候 forceSaveConfig 完成，直接进入 quitAndInstall。
      // 背景：macOS Intel 上磁盘 IO 较慢，若 await forceSaveConfig 期间
      // before-quit 快捷路径未调用 event.preventDefault() 就放行 quit，
      // 会导致进程在 quitAndInstall 调用前就退出，ShipIt 只收到 InstallOnly。
      // 改为 fire-and-forget：先确保 Squirrel 收到安装指令，配置市异步保存。
      forceSaveConfig()
      console.info('Browser data synced, quitting app and updating immediately')

      if (isPackaged) {
        await this.quitAndInstall(relaunch)
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

  /**
   * @param relaunch 安装完成后是否重新打开 APP；true=装完重开，false=仅安装不拉起
   */
  async quitAndInstall(relaunch = true) {
    this.quitAndInstallPromiser = Promise.withResolvers<void>()
    this.isQuittingForUpdate = true

    // electron-updater 非静默时会忽略 quitAndInstall 第二参数，改用 autoRunAppAfterInstall
    // 决定是否给 NSIS 传 --force-run；必须在此同步，纯退出才能装完不拉起
    this.#autoUpdater.autoRunAppAfterInstall = relaunch
    // isSilent=false: 让真实 NSIS 安装器以非静默方式运行并显示安装进度（仅对 Windows 生效）
    this.#autoUpdater.quitAndInstall(false, relaunch)
    // return this.quitAndInstallPromiser.promise
  }

  /** 当 APP 处于空闲状态时，安装更新 */
  async installUpdateWhenIdle() {
    if (!this.shouldAutoInstallUpdate() || !getAppIdleState()) {
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
