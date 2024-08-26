import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import type { Browser } from 'puppeteer-core'
import { needSyncLocalFileMap } from '/@/modules/browser/browser-manager/constants'
import { appConfig, ossObject } from '/@/constants'
import type { WindowItemType } from '/@/modules/browser/browser-manager/types'
import { aliOSS, filesToZip, proxyDetection } from '/@/utils'
import type { AfterLaunchTask } from './afterLaunchTask'
import { createReadStream } from 'node:fs'
import { API } from '/@/api'

export class BrowserItem {
  private afterLaunchTask!: AfterLaunchTask
  /** 浏览器实例 */
  browser: Browser | null = null
  /** 当前浏览器配置信息 */
  winInfo: WindowItemType
  /** 浏览器关闭后，上传数据 promise */
  private uploadDataPromiser = Promise.withResolvers()
  /** 当前浏览器用户数据目录 */
  userDataDir: string
  /** 用户浏览器数据缓存文件名称 */
  browserCacheFileName = 'browser-cache.zip'
  /** 指纹配置文件路径 */
  get fingerprintConfigPath() {
    return join(this.userDataDir, 'lumi.conf')
  }

  /** 本地 OSS 缓存目录 */
  get ossCacheDir() {
    return join(this.userDataDir, 'oss-session')
  }

  /** 本地 OSS 缓存版本文件路径 */
  get ossCacheVersionPath() {
    return join(this.ossCacheDir, 'version')
  }

  /** OSS 用户数据目录 */
  get ossRemoteCacheDir() {
    return `${ossObject.userWindowDataDir}/${this.winInfo.dirId}`
  }

  /** 需要同步到 OSS 的文件 */
  get needSyncFiles() {
    return needSyncLocalFileMap.filter(item => this.winInfo[item.key]).map(item => item.path)
  }

  constructor(winItem: WindowItemType) {
    this.winInfo = winItem
    // 这里不写成 getter 是因为启动时就要确定的，如果后续用户修改了缓存目录，正在运行的浏览器不会受到影响
    this.userDataDir = join(appConfig.browserCacheRootDir, winItem.dirId!)
  }

  /** 启动浏览器 */
  async launch() {
    if (this.browser) {
      return
    }

    const { BeforeLaunchTask } = await import('./beforeLaunchTask')
    // 创建启动任务
    const beforeLaunchTask = new BeforeLaunchTask(this.winInfo)
    // 拉起浏览器
    this.browser = await beforeLaunchTask.run()
    // 浏览器关闭时，需要上传本地数据和状态
    this.browser?.on('disconnected', async () => {
      try {
        await this.uploadData()
        this.uploadDataPromiser.resolve(true)
      }
      catch (error) {
        this.uploadDataPromiser.reject(error)
      }
    })
    const { AfterLaunchTask } = await import('./afterLaunchTask')
    // 创建启动后任务
    this.afterLaunchTask = new AfterLaunchTask(this.winInfo, this.browser!)
    // 异步执行启动后的任务, 不需要等待
    this.afterLaunchTask.run()
  }

  /** 关闭浏览器 */
  async close() {
    if (this.browser) {
      this.browser.close()
      return this.uploadDataPromiser.promise
    }
  }

  /** 关闭浏览器后需要同步的数据 */
  private async uploadData() {
    const params = await this.afterLaunchTask.getUploadData()
    const { id, syncValue } = this.winInfo

    console.log('update_message:', params)

    const needSyncFiles = this.needSyncFiles.map(url => ({
      path: join(this.userDataDir, url),
      destPath: url,
    }))

    // build pages
    const outputZipPath = join(this.ossCacheDir, this.browserCacheFileName)
    try {
      await filesToZip(needSyncFiles, outputZipPath)

      const remoteOssPath = `${this.ossRemoteCacheDir}/${this.browserCacheFileName}`
      const readStream = createReadStream(outputZipPath)
      const data = await aliOSS.putStream(remoteOssPath, readStream)
      const newVersion = syncValue.version ? syncValue.version + 1 : 1
      writeFile(this.ossCacheVersionPath, String(newVersion))
      console.log(`oss 上传`, data)

      // this.webContents.send("update_message_md5", {
      //   ...parmes,
      //   id: this.obj.id,
      //   syncValue: {
      //     version: newVersion,
      //   },
      // });

      const uploadParams = {
        id,
        cookie: Array.isArray(params.cookie) ? JSON.stringify(params.cookie) : params.cookie,
        defaultOpenUrl: params.defaultOpenUrl,
        lumiLogin: params.lumiLogin,
        syncValue: {
          version: newVersion,
        },
        openStatus: false,
      }
      // 同步窗口状态
      API.window.userMdfWindowSyncV2Create([uploadParams]).then((res) => {
        console.log('user_mdf_window_sync_v2', res)
      })
    }
    catch (error) {
      console.log('filesToZip error: ', error)
    }
  }

  /** 代理检测 */
  async proxyDetection() {
    return proxyDetection(this.winInfo)
  }

  /** 过滤标签页 */
  filterTab(url: string) {
    const invalidUrls = ['chrome://newtab/', 'chrome-extension://', 'about:blank']
    if (invalidUrls.includes(url)) {
      return false
    }
    return true
  }
}
