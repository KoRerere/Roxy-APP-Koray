import { createReadStream } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import type { WindowItemType } from '/@/modules/browser/browser-manager/types'
import { API } from '/@/api'
import { getInvalidUrls, needSyncLocalFileMap } from '/@/modules/browser/browser-manager/constants'
import { getUserDataDirPath } from '/@/modules/browser/browser-manager/utils'
import { chromeCoreManager } from '/@/modules/browser/chrome-core-manager'
import { fileOperations } from '/@/modules/fileOperations'
import { delRoxynetProxy } from '/@/modules/roxynet'
import { aliOSS, proxyDetection } from '/@/utils'
import { genRandomFingerprint } from '/@/utils/randomFingerprint'
import { AfterLaunchTask } from './afterLaunchTask'
import { BeforeLaunchTask } from './beforeLaunchTask'
import { sendErrorMessage } from '/@/modules/browser/browser-manager/message'
import { removeSyncWindowByPid } from '/@/modules/sync-control/bin'
import { openAPICommonHeaders } from '/@/constants/common'
import { canUseSyncControl } from '/@/modules/store'
import { setTimeout } from 'node:timers/promises'
import type { CDPSession } from './chrome-wrapper/'

// 创建一个事件发射器
const emitter = new EventEmitter()

export type LaunchBy = 'app' | 'api'

export class BrowserItem {
  beforeLaunchTask!: BeforeLaunchTask
  private afterLaunchTask!: AfterLaunchTask

  on = (event: string, listener: (...args: any[]) => void) => {
    emitter.on(event, listener)
    return this
  }

  off = (event: string, listener: (...args: any[]) => void) => {
    emitter.off(event, listener)
    return this
  }
  /** 启动后是否已经同步过窗口打开状态 */
  isSyncedWindowOpenStatus = false
  /** 通过哪种方式启动的浏览器 */
  launchBy: LaunchBy = 'app'
  /** 公共请求头 */
  get requestHeaders() {
    return {
      ...(this.launchBy === 'api' ? openAPICommonHeaders : {}),
      workspaceId: this.winInfo.workspaceId,
    }
  }
  /** 当前浏览器配置信息 */
  winInfo: WindowItemType
  /** 浏览器关闭后，上传数据 promise */
  private uploadDataPromiser = Promise.withResolvers<{ requestHeaders?: any, uploadParams?: any }>()
  /** 当前浏览器用户数据目录 */
  userDataDir: string
  /** 用户浏览器数据缓存文件名称 */
  browserCacheFileName = 'browser-cache.zip'
  /** 浏览器进程 ID */
  private browserPid?: number | null = null
  /** 是否首次通过工作台检测代理 */
  isFirstDetectProxyByDashboard = true
  /** 浏览器实例 */
  get #browser() {
    return this.beforeLaunchTask?.browser
  }

  /** 指纹配置文件路径 */
  get fingerprintConfigPath() {
    return join(this.userDataDir, 'lumi.conf')
  }

  /** 浏览器关闭后，标签页保存的文件路径 */
  get roxyTabsPath() {
    return join(this.userDataDir, 'roxy_tabs')
  }


  /** 浏览器本地状态设置 */
  get roxyLocalStatePath() {
    return join(this.userDataDir, 'Local State')
  }

  /** lumiLogin 文件路径 */
  get lumiLoginPath() {
    return join(this.userDataDir, 'Default', 'LumiLogin')
  }

  /** 浏览器偏好设置文件路径 */
  get preferencesPath() {
    return join(this.userDataDir, 'Default', 'Preferences')
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

  /** 最后一次发送的消息 */
  get lastMessage() {
    return this.beforeLaunchTask.lastMessage
  }

  /** 启动成功后的信息 */
  get launchInfo() {
    return {
      dirId: this.winInfo.dirId,
      /** 用于自动化工具的ws接口 */
      ws: this.beforeLaunchTask.wsEndpoint,
      /** 用于自动化工具的http接口 */
      http: new URL(this.beforeLaunchTask.wsEndpoint!).host,
      /** 内核版本 */
      coreVersion: this.winInfo.coreVersion,
      /** 用于自动化工具的 webdriver */
      driver: chromeCoreManager.genCoreDriverPath(this.winInfo.coreVersion),
      /** 窗口排序号 */
      sortNum: this.winInfo.windowSortNum,
      /** 窗口名称 */
      windowName: this.winInfo.windowName,
      /** 窗口备注 */
      windowRemark: this.winInfo.windowRemark,
      /** 进程id */
      pid: this.browserPid,
    }
  }

  /** 当前内核信息 */
  get coreVersion() {
    const { version, coreVersion, releaseTime } = chromeCoreManager.getAvailableCore(this.winInfo.coreVersion)
    return {
      version,
      coreVersion,
      releaseTime,
    }
  }

  constructor(winItem: WindowItemType, launchBy: LaunchBy = 'app') {
    this.launchBy = launchBy
    this.winInfo = winItem
    Reflect.set(this.winInfo, '$canUseSyncControl', canUseSyncControl())
    // 这里不写成 getter 是因为启动时就要确定的，如果后续用户修改了缓存目录，正在运行的浏览器不会受到影响
    this.userDataDir = getUserDataDirPath(winItem.dirId!)
  }

  /** 获取浏览器实例 */
  getBrowser() {
    return this.#browser
  }

  /** 启动浏览器 */
  async launch() {
    // 如果浏览器已经存在，直接激活
    if (this.#browser) {
      await this.beforeLaunchTask.makeBrowserActive().catch((error) => {
        console.error(`make browser active ${this.winInfo.dirId} === 重新拉起`, error)
      })
    }
    else {
      // 启动时是否需要生成随机指纹
      this.handleRandomFingerprint()
      // 创建启动任务
      this.beforeLaunchTask = new BeforeLaunchTask(this)
      // 拉起浏览器
      await this.beforeLaunchTask.run()
      // 创建启动后任务
      this.afterLaunchTask = new AfterLaunchTask(this, this.#browser!)
      // 异步执行启动后的任务, 不需要等待
      this.afterLaunchTask.run()
      // 浏览器关闭时，需要上传本地数据和状态
      this.#browser!.on('process-close', this.handleOnDisconnected)
      // 记录浏览器进程 ID
      this.browserPid = this.#browser!.process()?.pid
    }
  }

  /** 当 Puppeteer 与浏览器实例断开连接时发出。这可能是因为：浏览器关闭/崩溃或调用Browser.disconnect() */
  handleOnDisconnected = async () => {
    const dirId = this.winInfo.dirId!
    try {
      const uploadDataPromise = this.uploadData()
      emitter.emit(`close-${dirId}`, uploadDataPromise)
      removeSyncWindowByPid(this.browserPid!)
      const { requestHeaders, uploadParams } = await uploadDataPromise
      this.uploadDataPromiser.resolve({ requestHeaders, uploadParams })
    }
    catch (error) {
      this.uploadDataPromiser.reject(error)
    } finally {
      delRoxynetProxy(dirId)
    }
  }

  /** 关闭浏览器 */
  async close() {
    if (this.#browser) {
      // 有些时候浏览器进程被关闭了，但是 puppeteer 进程还在，这里需要手动关闭
      await this.#browser.close()
      this.beforeLaunchTask.browser = null

      return this.uploadDataPromiser.promise
    }
  }

  /** 关闭浏览器后需要同步的数据 */
  async uploadData() {
    const params = await this.afterLaunchTask.getUploadData()
    const { id, syncValue, ossDirPath } = this.winInfo

    const needSyncFiles = this.needSyncFiles.map(url => ({
      src: join(this.userDataDir, url),
      dest: url,
    }))

    const outputZipPath = join(this.ossCacheDir, this.browserCacheFileName)
    let newVersion = syncValue?.version || 1
    console.log('需要同步的文件：', needSyncFiles)
    try {
      const outputDist = await fileOperations.executeTask('compressFiles', { files: needSyncFiles, dest: outputZipPath })
      console.log('缓存文件压缩成功：', outputDist)
      const remoteOssPath = `${ossDirPath}${this.browserCacheFileName}`
      const readStream = createReadStream(outputZipPath)
      console.log('开始上传缓存文件', remoteOssPath)
      const data = await aliOSS.putStream(remoteOssPath, readStream, { workspaceId: this.winInfo.workspaceId })
      newVersion = newVersion + 1
      writeFile(this.ossCacheVersionPath, String(newVersion))
      console.log(`oss 缓存文件上传成功`)
    }
    catch (error) {
      console.log('uploadData error: ', error)
    }
    finally {
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

      return { requestHeaders: this.requestHeaders, uploadParams }

      // 同步窗口状态
      // await API.window.userMdfWindowSyncV2Create([uploadParams], { headers: this.requestHeaders }).then((res) => {
      //   console.log('user_mdf_window_sync_v2 uploadData', res)
      // }).catch((error) => {
      //   console.error('user_mdf_window_sync_v2 uploadData error: ', error)
      // })
    }
  }

  /** 启动时生成随机指纹 */
  async handleRandomFingerprint() {
    if (this.winInfo.randomFingerprint) {
      const [fingerprint] = await genRandomFingerprint(this.winInfo, 1, this.launchBy).catch((error) => {
        console.error('genRandomFingerprint error: ', error)
        sendErrorMessage($t('启动时生成随机指纹失败'), this.winInfo.dirId!, error)
        return Promise.reject(new Error($t('启动时生成随机指纹失败')))
      })
      try {
        const { code } = await API.window.userMdfWindowInfoSingleV2Create({ id: this.winInfo.id, ...fingerprint }, { headers: this.requestHeaders })
        if (code === 0) {
          console.log('修改指纹成功', fingerprint)
          const { code, data } = await API.window.userGetWindowInfoV2List({ id: this.winInfo.id, sourceType: 'open' }, { headers: this.requestHeaders })
          if (code === 0 && data.rows[0]) {
            // console.log('获取窗口信息成功', data.rows[0])
            this.winInfo = data.rows[0]
            Reflect.set(this.winInfo, '$canUseSyncControl', canUseSyncControl())
          }
        }
      } catch (error) {
        console.error('userMdfWindowInfoSingleV2Create error: ', error)
      }
    }
  }

  /** 代理检测 */
  async proxyDetection(isDetectWithOpenapi = false) {
    if (this.isFirstDetectProxyByDashboard && isDetectWithOpenapi && this.beforeLaunchTask.proxyInfo?.ip) {
      this.isFirstDetectProxyByDashboard = false
      return this.beforeLaunchTask.proxyInfo
    }

    const res = await proxyDetection(this.winInfo)
    if (!this.beforeLaunchTask.proxyInfo?.ip && res?.ip) {
      this.beforeLaunchTask.proxyInfo = res
    }
    if (isDetectWithOpenapi) {
      this.isFirstDetectProxyByDashboard = false
    }
    return res
  }

  /** 是否是有效的 URL */
  isValidURL(url: string) {
    return !getInvalidUrls().some(n => url.startsWith(n!))
  }

}
