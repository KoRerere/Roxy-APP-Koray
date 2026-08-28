import type { WindowItemType } from '/@/modules/browser/browser-manager/types'
import { genRandomFingerprint } from '@roxy/shared'
import { get } from 'es-toolkit/compat'
import { EventEmitter } from 'node:events'
import { createReadStream } from 'node:fs'
import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { API } from '/@/api'
import { openAPICommonHeaders } from '/@/constants/common'
import { CoreType } from '/@/modules/browser/browser-manager/adapter'
import { getInvalidUrls, getNeedSyncLocalFileMap } from '/@/modules/browser/browser-manager/constants'
import { sendErrorMessage } from '/@/modules/browser/browser-manager/message'
import { getUserDataDirPath } from '/@/modules/browser/browser-manager/utils'
import { coreManager } from '/@/modules/browser/core-manager'
import { fileOperations } from '/@/modules/fileOperations'
import { ipcSender } from '/@/modules/ipc'
import { delRoxynetProxy } from '/@/modules/roxynet'
import { canUseSyncControl } from '/@/modules/store'
import { removeSyncWindowByPid } from '/@/modules/sync-control/bin'
import { aliOSS, decryptAESGCM, getLocalFonts, getMacAddress, proxyDetection } from '/@/utils'
import { AfterLaunchTask } from './afterLaunchTask'
import { BeforeLaunchTask } from './beforeLaunchTask'

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
  /** 启动成功时间戳（毫秒），用于关闭时计算本次打开时长 */
  openedAt?: number
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

  /** 内核类型（CoreType.Chrome | CoreType.Firefox），来源于后端下发的 winInfo.coreType */
  get coreType(): CoreType {
    return (this.winInfo.coreType as CoreType) || CoreType.Chrome
  }

  /** 是否是 Firefox 内核 */
  get isFirefox() {
    return this.coreType === CoreType.Firefox
  }

  /** 指纹配置文件路径 */
  get fingerprintConfigPath() {
    return join(this.userDataDir, 'lumi.conf')
  }

  get closeTimestampPath() {
    return join(this.userDataDir, 'close_timestamp')
  }

  /** 浏览器关闭后，标签页保存的文件路径 */
  get roxyTabsPath() {
    return join(this.userDataDir, 'roxy_tabs')
  }

  /** 浏览器本地状态设置（Chrome 专用） */
  get roxyLocalStatePath() {
    return join(this.userDataDir, 'Local State')
  }

  /** lumiLogin 文件路径，Firefox 直接放在 profile 根目录下，Chrome 在 Default 下 */
  get lumiLoginPath() {
    return this.isFirefox
      ? join(this.userDataDir, 'lumilogin')
      : join(this.userDataDir, 'Default', 'LumiLogin')
  }

  /** 浏览器偏好设置文件路径（Chrome 专用） */
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
    return Object.entries(getNeedSyncLocalFileMap(this.coreType)).filter(([key]) => get(this.winInfo, key)).flatMap(([_, value]) => value)
  }

  /** 最后一次发送的消息 */
  get lastMessage() {
    return this.beforeLaunchTask.lastMessage
  }

  /** 虚拟摄像头 fake 视频目录 */
  get fakeVideoDir() {
    return join(this.userDataDir, 'fakevideo')
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
      driver: coreManager.getCoreManager(this.coreType).genCoreDriverPath(this.winInfo.coreVersion),
      /** 窗口排序号 */
      sortNum: this.winInfo.windowSortNum,
      /** 窗口名称 */
      windowName: this.winInfo.windowName,
      /** 窗口备注 */
      windowRemark: this.winInfo.windowRemark,
      /** 进程id */
      pid: this.browserPid,
      /** Marionette 端口（仅 Firefox 内核，供 Selenium/GeckoDriver 使用） */
      marionette_port: this.isFirefox ? (this.#browser?.marionettePort ?? '') : undefined,
    }
  }

  /** 当前内核信息 */
  get coreVersion() {
    const { version, coreVersion, releaseTime } = coreManager.getCoreManager(this.coreType).getAvailableCore(this.winInfo.coreVersion)
    return {
      version,
      coreVersion,
      releaseTime,
    }
  }

  constructor(winItem: WindowItemType, launchBy: LaunchBy = 'app') {
    this.launchBy = launchBy
    this.winInfo = winItem
    // 这里不写成 getter 是因为启动时就要确定的，如果后续用户修改了缓存目录，正在运行的浏览器不会受到影响
    this.userDataDir = getUserDataDirPath(winItem.dirId!)
    // 如果 coreType 没有设置，则默认使用 Chrome
    this.winInfo.coreType ||= CoreType.Chrome
  }

  /** 获取浏览器实例 */
  getBrowser() {
    return this.#browser
  }

  /** 在已打开的浏览器中打开 URL（兼容 Firefox BiDi 重连） */
  async openUrls(urls: string[]) {
    if (!this.#browser) {
      return
    }
    if (this.afterLaunchTask) {
      await this.afterLaunchTask.openUrls(urls)
      return
    }
    for (const url of urls.filter(Boolean)) {
      await this.#browser.newPage(url).catch((error) => {
        console.error(`[BrowserItem] openUrls failed for ${url}:`, error)
      })
    }
  }

  /** 启动浏览器 */
  async launch() {
    // 如果浏览器已经存在，直接激活
    if (this.#browser) {
      await this.beforeLaunchTask.makeBrowserActive().catch((error) => {
        console.error(`make browser active ${this.winInfo.dirId} === Relaunch failed`, error)
      })
    }
    else {
      // 启动时是否需要生成随机指纹
      await this.handleRandomFingerprint()
      queueMicrotask(async () => {
        Reflect.set(this.winInfo, '$canUseSyncControl', await canUseSyncControl())
      })
      // 解密代理信息
      await this.decryptProxyInfo().catch((error) => {
        console.error('decryptProxyInfo error: ', error)
      })
      // 创建启动任务
      this.beforeLaunchTask = new BeforeLaunchTask(this)
      // 拉起浏览器
      await this.beforeLaunchTask.run()
      // 创建启动后任务
      this.afterLaunchTask = new AfterLaunchTask(this, this.#browser!)
      // 浏览器关闭时，需要上传本地数据和状态
      this.#browser!.on('process-close', this.handleOnDisconnected)
      // 记录浏览器进程 ID
      this.browserPid = this.#browser!.process()?.pid
      // 异步执行启动后的任务, 不需要等待
      await this.afterLaunchTask.run()
      // 仅新开实例计时；已打开再激活不重置，保证关闭上报覆盖整段会话
      this.openedAt = Date.now()

      // ipcSender.user.mixpanelTrack('profile_start', {
      //   coreVersion: this.coreVersion.coreVersion,
      //   browserType: 'chrome',
      //   headless: this.beforeLaunchTask.launchArgs.some(arg => arg.startsWith('--headless')),
      // })

      console.log('BrowserItem launchInfo', this.launchInfo)
    }
  }

  /** 当 Puppeteer 与浏览器实例断开连接时发出。这可能是因为：浏览器关闭/崩溃或调用Browser.disconnect() */
  handleOnDisconnected = async () => {
    const dirId = this.winInfo.dirId!
    try {
      // Firefox：BiDi session 已在启动后释放，进程关闭时通过 cookies.sqlite 读取最新 cookie。
      // 无论是用户点 X 关闭窗口还是 App 触发 close()，都确保 cookie 被保存。
      if (this.isFirefox && this.afterLaunchTask) {
        await this.afterLaunchTask.saveCookiesNow().catch((e) => {
          console.warn('[BrowserItem] Firefox cookie save in handleOnDisconnected failed:', e)
        })
      }
      const uploadDataPromise = this.uploadData()
      emitter.emit(`close-${dirId}`, uploadDataPromise)
      removeSyncWindowByPid(this.browserPid!)
      const { requestHeaders, uploadParams } = await uploadDataPromise
      this.uploadDataPromiser.resolve({ requestHeaders, uploadParams })
    }
    catch (error) {
      this.uploadDataPromiser.reject(error)
    }
    finally {
      delRoxynetProxy(dirId)
      writeFile(this.closeTimestampPath, `${Date.now().toString()}_${dirId}`).catch((error) => {
        console.warn(`[BrowserItem] write close_timestamp failed (${dirId}):`, error)
      })
      rm(this.fakeVideoDir, { recursive: true, force: true }).catch(() => { })
      // ipcSender.user.mixpanelTrack('profile_end', {
      //   coreVersion: this.coreVersion.coreVersion,
      //   browserType: 'chrome',
      //   headless: this.beforeLaunchTask.launchArgs.some(arg => arg.startsWith('--headless')),
      // })
    }
  }

  /** 关闭浏览器 */
  async close() {
    if (this.#browser) {
      // Chrome: 在关闭 CDP 连接前先保存 cookie, 避免 WebSocket 断开后读不到最新数据.
      // Firefox: 仍在 handleOnDisconnected 中 process-close 后读 cookies.sqlite (进程持有 DB 锁).
      if (!this.isFirefox && this.afterLaunchTask) {
        await this.afterLaunchTask.saveCookiesNow().catch((error) => {
          console.warn(`[BrowserItem] saveCookiesNow before close failed (${this.winInfo.dirId}):`, error)
        })
      }
      // 有些时候浏览器进程被关闭了，但是 puppeteer 进程还在，这里需要手动关闭
      await this.#browser.close()
      this.beforeLaunchTask.browser = null

      return this.uploadDataPromiser.promise
    }
  }

  async decryptProxyInfo() {
    const { isEncryptProxy, proxyEncryptInfo } = this.winInfo
    // 如果代理信息是加密的，则解密
    if (isEncryptProxy && proxyEncryptInfo) {
      const decryptedProxyEncryptInfo = await decryptAESGCM(proxyEncryptInfo)
      Object.assign(this.winInfo, decryptedProxyEncryptInfo)
    }
  }

  /** 关闭浏览器后需要同步的数据 */
  async uploadData() {
    const params = await this.afterLaunchTask.getUploadData()

    const { id, dirId, syncValue, ossDirPath, syncCookie, allOpenUrl, $keepOriginOpenUrl } = this.winInfo

    const needSyncFiles = this.needSyncFiles.map(url => ({
      src: join(this.userDataDir, url),
      dest: url,
    }))

    const outputZipPath = join(this.ossCacheDir, this.browserCacheFileName)
    let newVersion = syncValue?.version || 1
    const lastFileCount = syncValue?.fileCount
    let isUploadSuccess = false
    console.log('Files to sync:', needSyncFiles)
    try {
      if (needSyncFiles.length === 0 && lastFileCount === 0) {
        console.log('No files to sync')
        return
      }

      const outputDist = await fileOperations.executeTask('compressFiles', { files: needSyncFiles, dest: outputZipPath })
      console.log('Cache files compressed successfully:', outputDist)
      const remoteOssPath = `${ossDirPath}${this.browserCacheFileName}`
      const readStream = createReadStream(outputZipPath)
      console.log('Starting to upload cache files', remoteOssPath)
      const data = await aliOSS.putStream(remoteOssPath, readStream, { workspaceId: this.winInfo.workspaceId })
      newVersion = newVersion + 1
      isUploadSuccess = true
      writeFile(this.ossCacheVersionPath, String(newVersion))
      console.log(`OSS cache files uploaded successfully`)
    }
    catch (error) {
      console.log('uploadData error: ', error)
    }
    finally {
      const uploadParams = {
        id,
        cookie: syncCookie ? (Array.isArray(params.cookie) ? JSON.stringify(params.cookie) : params.cookie) : undefined,
        defaultOpenUrl: $keepOriginOpenUrl ? allOpenUrl : params.defaultOpenUrl,
        lumiLogin: params.lumiLogin,
        syncValue: {
          version: newVersion,
          fileCount: isUploadSuccess ? needSyncFiles.length : syncValue?.fileCount,
        },
        openStatus: false,
        // 本次打开时长（秒），随关闭同步一并上报
        useDuration: this.openedAt
          ? Math.max(0, Math.floor((Date.now() - this.openedAt) / 1000))
          : undefined,
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
    if (!this.winInfo.randomFingerprint) {
      return
    }

    try {
      const [fingerprint] = await genRandomFingerprint({
        payload: this.winInfo,
        count: 1,
        genType: this.launchBy,
        API,
        getMacAddress,
        local_fonts: getLocalFonts(),
      }).catch((error) => {
        console.error('genRandomFingerprint error: ', error)
        sendErrorMessage($t('启动时生成随机指纹失败'), this.winInfo.dirId!, error)
        return Promise.reject(new Error($t('启动时生成随机指纹失败')))
      })

      const { code } = await API.window.userMdfWindowInfoSingleV2Create({ id: this.winInfo.id, ...fingerprint }, { headers: this.requestHeaders })
      if (code === 0) {
        console.log('Fingerprint modified successfully', fingerprint)
        const { code, data } = await API.window.userGetWindowInfoV2List({ id: this.winInfo.id, sourceType: 'open' }, { headers: this.requestHeaders })
        if (code === 0 && data.rows[0]) {
          // console.log('获取窗口信息成功', data.rows[0])
          Object.assign(this.winInfo, data.rows[0])
          Reflect.set(this.winInfo, '$canUseSyncControl', await canUseSyncControl())
        }
      }
    }
    catch (error) {
      console.error('userMdfWindowInfoSingleV2Create error: ', error)
    }
  }

  /** 代理检测 */
  async proxyDetection(isDetectWithOpenapi = false) {
    if (this.isFirstDetectProxyByDashboard && isDetectWithOpenapi && this.beforeLaunchTask.proxyInfo?.ip) {
      this.isFirstDetectProxyByDashboard = false
      return this.beforeLaunchTask.proxyInfo
    }

    const { protocol, port, ...res } = await proxyDetection(this.winInfo)

    const _protocol = protocol || this.winInfo.protocol?.split('/')[0]
    const _port = port || this.winInfo.port?.toString().split('/')[0]
    this.winInfo.protocol = _protocol
    this.winInfo.proxyCategory = _protocol
    this.winInfo.port = _port

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

  async cookieRobot(params: any) {
    this.afterLaunchTask.cookieRobot(params)
  }
}
