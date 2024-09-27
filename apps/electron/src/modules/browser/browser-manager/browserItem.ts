import { createReadStream } from 'node:fs'
import { readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { WindowItemType } from '/@/modules/browser/browser-manager/types'
import { API } from '/@/api'
import { appConfig } from '/@/constants'
import { cacheToClear, invalidUrls, needSyncLocalFileMap } from '/@/modules/browser/browser-manager/constants'
import { aliOSS, filesToZip, proxyDetection } from '/@/utils'
import { AfterLaunchTask } from './afterLaunchTask'
import { BeforeLaunchTask } from './beforeLaunchTask'

export class BrowserItem {
  private beforeLaunchTask!: BeforeLaunchTask
  private afterLaunchTask!: AfterLaunchTask
  /** 浏览器实例 */
  get #browser() {
    return this.beforeLaunchTask?.browser
  }

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

  /** lumiLogin 文件路径 */
  get lumiLoginPath() {
    return join(this.userDataDir, 'Default', 'LumiLogin')
  }

  /** 本地 OSS 缓存目录 */
  get ossCacheDir() {
    return join(this.userDataDir, 'oss-session')
  }

  /** 本地 OSS 缓存版本文件路径 */
  get ossCacheVersionPath() {
    return join(this.ossCacheDir, 'version')
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

  /** 获取浏览器实例 */
  getBrowser() {
    return this.#browser
  }

  /** 启动浏览器 */
  async launch() {
    // 如果浏览器已经存在，直接激活
    if (this.#browser) {
      this.beforeLaunchTask.makeBrowserActive().catch((error) => {
        console.error(`make browser active ${this.winInfo.dirId} === 重新拉起`, error)
      })
      return
    }

    // 创建启动任务
    this.beforeLaunchTask = new BeforeLaunchTask(this)
    // 拉起浏览器
    await this.beforeLaunchTask.run()
    // 浏览器关闭时，需要上传本地数据和状态
    this.#browser!.on('disconnected', async () => {
      try {
        await this.uploadData()
        this.uploadDataPromiser.resolve(true)
      }
      catch (error) {
        this.uploadDataPromiser.reject(error)
      }
    })
    // 创建启动后任务
    this.afterLaunchTask = new AfterLaunchTask(this, this.#browser!)
    // 异步执行启动后的任务, 不需要等待
    this.afterLaunchTask.run()
  }

  /** 关闭浏览器 */
  async close() {
    if (this.#browser) {
      // 有些时候浏览器进程被关闭了，但是 puppeteer 进程还在，这里需要手动关闭
      const pid = this.#browser.process()?.pid
      await this.#browser.close().finally(async () => {
        if (pid) {
          try {
            process.kill(pid)
          }
          catch (error) {
            // $LOG(`kill browser process`, error);
          }
        }
      })
      this.beforeLaunchTask.browser = null

      return this.uploadDataPromiser.promise
    }
  }

  /** 关闭浏览器后需要同步的数据 */
  private async uploadData() {
    const params = await this.afterLaunchTask.getUploadData()
    const { id, syncValue, ossDirPath } = this.winInfo

    console.log('uploadData:', params)

    const needSyncFiles = this.needSyncFiles.map(url => ({
      path: join(this.userDataDir, url),
      destPath: url,
    }))

    // build pages
    const outputZipPath = join(this.ossCacheDir, this.browserCacheFileName)
    try {
      await filesToZip(needSyncFiles, outputZipPath)
      const remoteOssPath = `${ossDirPath}${this.browserCacheFileName}`
      const readStream = createReadStream(outputZipPath)
      const data = await aliOSS.putStream(remoteOssPath, readStream)
      const newVersion = syncValue?.version ? syncValue.version + 1 : 1
      writeFile(this.ossCacheVersionPath, String(newVersion))
      console.log(`oss 上传`, data)

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
      await API.window.userMdfWindowSyncV2Create([uploadParams]).then((res) => {
        console.log('user_mdf_window_sync_v2', res)
      })
    }
    catch (error) {
      console.log('filesToZip error: ', error)
    }
  }

  /** 删除本地浏览器数据 */
  async removeLocalData() {
    await this.close()
    // 删除本地浏览器数据目录
    rm(this.userDataDir, { recursive: true })
  }

  /** 清除本地缓存（扩展数据除外） */
  async removeLocalDataExcludeExtension() {
    await this.close()

    const files = await readdir(this.userDataDir)

    const outPromises = files.map(async (file) => {
      if (file === 'Default') {
        const defaultDir = join(this.userDataDir, file)
        const defaultFiles = await readdir(defaultDir)
        const innerPromises = defaultFiles.map(async (defaultFile) => {
          if (!cacheToClear.includes(defaultFile)) {
            const filterDirPath = join(defaultDir, defaultFile)
            await rm(filterDirPath, { recursive: true })
          }
        })
        await Promise.all(innerPromises)
      }
      else {
        await rm(join(this.userDataDir, file), { recursive: true })
      }
    })

    await Promise.all(outPromises)
  }

  /** 代理检测 */
  async proxyDetection() {
    return proxyDetection(this.winInfo)
  }

  /** 是否是有效的 URL */
  isValidURL(url: string) {
    return !invalidUrls.some(n => url.includes(n!))
  }
}
