import path from 'node:path'
import { AppUpdater } from 'electron-updater'
import { app } from 'electron'
import { compare } from 'compare-versions'
import { API } from '/@/api'
import { osConfig } from '/@/constants'

const isDevelopment = !app.isPackaged

export const appUpdater = new class {
  /** 是否在下载中 */
  isInProgress = false
  /** 轮询更新时间 */
  timeout = 1000 * (isDevelopment ? 30 : 60)
  private autoUpdater!: AppUpdater

  constructor() {
    this.init()
  }

  async init() {
    setTimeout(() => {
      this.init()
    }, this.timeout)

    const { data } = await API.base.userGetAppUpgradeCreate(osConfig)

    console.log(`AppUpdater init data`, data)

    const { downloadUrl, version } = data
    // downloadUrl = `http://localhost:7788/static`
    console.log(`AppUpdater downloadUrl`, downloadUrl)

    if (!downloadUrl) {
      console.log(`更新地址为空 跳出更新`)
      return
    }
    // $LOG(`update options `, this.options);

    const options = {
      requestHeaders: {
      },
      provider: 'generic',
      url: downloadUrl,
    }

    $LOG.info(`AppUpdater init  this.options`, this.options)

    this.message = message.data?.data || {}

    $LOG.info(`AppUpdater init this.message`, this.message)

    if (this.autoUpdater) {
      // 动态更新autoUpdater的配置
      this.autoUpdater.setFeedURL(options)
      console.log('APP 远程版本：', version)
      console.log('APP 本地版本：', app.getVersion())
      console.log('远程版本是否大于本地版本：', compare(version, app.getVersion(), '>'))
      // 远程版本发生变化，重新检查更新
      if (version && compare(version, app.getVersion(), '>')) {
        this.checkUpdate()
      }
      return
    }

    this.autoUpdater = new AppUpdater(this.options)
    this.autoUpdater.forceDevUpdateConfig = true

    // 防止报错no such file or directory dev-app-update.yml
    if (isDevelopment) {
      this.autoUpdater.updateConfigPath = path.join(__dirname, './dev-app-update.yml')
    }

    this.autoUpdater.autoInstallOnAppQuit = true

    this.autoUpdater.on(`error`, (error) => {
      this.isInProgress = false
      console.log(`autoUpdater 出现错误`, error)
      this.webContents.send('$version', {
        ...this.parmes,
        message: this.message,
        info_updata: true,
        reDownload: true,
      })

      this.webContents.send('auto-updater-error', ...arguments)
    })

    this.autoUpdater.on(`checking-for-update`, () => {
      console.log(`autoUpdater 检查更新`)
    })

    this.autoUpdater.on(`update-available`, (updateInfo) => {
      this.isInProgress = true
      console.log(`有更新`, updateInfo)
    })

    // 更新下载完成
    this.autoUpdater.on(`update-downloaded`, (event) => {
      this.isInProgress = false
      console.log(`更新下载完成`, event)

      webContents.send('$version', {
        ...th.parmes,
        message: th.message,
        code: app.getVersion(),
        info_updata: true,
        percent: 100,
        total: message.files[0].size,
        transferred: message.files[0].size,
      })
    })

    this.autoUpdater.on(`update-not-available`, (message) => {
      this.isInProgress = false
      $LOG.info(`无更新`, message)
      console.log(`无更新`, message)

      webContents.send('$version', {
        ...this.parmes,
        message: this.message,
        code: app.getVersion(),
        info_updata: false,
        percent: 100,
        total: message.files[0].size,
        transferred: message.files[0].size,
      })
    })

    this.autoUpdater.on(`download-progress`, (message) => {
      this.isInProgress = true
      console.log(`更新进度: `, message.percent)
      // {
      //     total: 366305518,
      //     delta: 6021615,
      //     transferred: 366305518,
      //     percent: 100,
      //     bytesPerSecond: 13831723
      //   }

      // if (percent == 100) {

      // } else {

      // }
      th.parmes = {
        ...this.parmes,
        ...message,
      }
      this.mainWindow.setProgressBar(message.percent / 100)
      webContents.send('$version', {
        ...th.parmes,
        message: th.message,
        code: app.getVersion(),
        info_updata: true,
        ...message,
      })
    })

    this.checkForUpdates()
  }

  async checkForUpdates() {
    console.info(`检查更新 checkUpdate`)

    if (this.isInProgress) {
      return
    }

    this.isInProgress = true
    const checkResult = await this.autoUpdater.checkForUpdates().catch((error) => {
      this.isInProgress = false
      console.log(`checkForUpdates error`, error)
    })

    console.log(`checkResult`, checkResult)
  }

  /** 是否有更新 */
  async hasUpdate() {
    const { data } = await API.base.userGetAppUpgradeCreate(osConfig)
    const { version } = data
    console.log(`远程版本`, version, `本地版本`, app.getVersion())
    return version && compare(version, app.getVersion(), '>')
  }

  /** 立即退出应用并且更新 */
  upgradeNow() {
    // autoUpdater.quitAndInstall();
    console.info(`立即退出应用并且更新`)
    this.autoUpdater.quitAndInstall(true, true)
  }
}()
