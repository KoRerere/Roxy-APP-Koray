import type { BrowserItem } from './browserItem'
import type { BrowserLaunchOptions, IBrowser } from '/@/modules/browser/browser-manager/adapter'
import type { proxyDetection } from '/@/utils'
import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { API } from '/@/api'
// import { appConfig } from '/@/constants'
import { isLinux, isMac, isWindows } from '/@/constants/common'
import { browserManager, coreManager } from '/@/modules/browser'
import { connectBrowser, launchBrowser } from '/@/modules/browser/browser-manager/adapter'
import { defaultCLIArgs, firefoxCacheToKeep, firefoxDefaultCLIArgs } from '/@/modules/browser/browser-manager/constants'
import { sendErrorMessage, sendSuccessMessage } from '/@/modules/browser/browser-manager/message'
import { ExtensionManager } from '/@/modules/extension'
import { getExtensionIDByPath } from '/@/modules/extension/helper'
import { fileOperations } from '/@/modules/fileOperations'
import { store } from '/@/modules/store'
import { aliOSS, fileExists, getDiskInfoByPath, getErrorMessage, getProxyEntityLabels } from '/@/utils'
import { getVirtualWorkAreaUnion } from '/@/utils/windowGridLayout'
import { encryptFingerprintConfig, genFingerprintConfig, importBookmarks } from './utils'
import { appendOpenUrlsToLaunchArgs } from './utils/splitOpenUrlsForLaunch'

const RE_MEM_TOTAL = /MemTotal:\s+(\d+)/
const RE_MEM_AVAILABLE = /MemAvailable:\s+(\d+)/

const firefoxBackgroundAutomationPrefs = [
  'user_pref("focusmanager.testmode", true);',
  'user_pref("layout.testing.top-level-always-active", true);',
  'user_pref("dom.min_background_timeout_value", 0);',
  'user_pref("dom.min_background_timeout_value_without_budget_throttling", 0);',
  'user_pref("dom.timeout.enable_budget_timer_throttling", false);',
]

/** 最后一次发送的消息 */
export interface LastMessage {
  dirId: string
  percent: number
  message: string
  warningMessages: string[]
}

interface LaunchTask { handler: () => Promise<void>, start: number, end: number }

/** 浏览器启动时要做的事情 */
export class BeforeLaunchTask {
  browser: IBrowser | null = null
  wsEndpoint: string | null = null
  /** 代理检测结果 */
  proxyInfo = {} as Awaited<ReturnType<typeof proxyDetection>>
  /** 不影响浏览器打开的警告信息 */
  warningMessages: string[] = []
  /** 内核执行程序路径 */
  exePath = ''
  /** 最后一次发送的消息 */
  lastMessage?: LastMessage
  /** 启动浏览器超时 */
  launchTimer?: NodeJS.Timeout
  /** 启动浏览器命令行参数 */
  launchArgs: string[] = []
  /** 本次启动是否伴随内核首次下载落盘：新 exe 首次运行会触发杀软实时扫描,初始化明显变慢,需放宽启动超时 */
  isFreshCoreInstall = false
  /** Windows 命令行过长时，延后到启动后通过 CDP 打开的 URL */
  deferredOpenUrls: string[] = []
  /** 当前任务 */
  private currentTask: LaunchTask | null = null
  /** 任务队列 */
  private taskMap = new Map<string, LaunchTask>()
  /** 任务进度 */
  private progress = 0
  // get progress() {
  //   return ~~((this.completedTasks / this.totalTasks) * 100)
  // }
  /** 是否是移动端 */
  get isMobile() {
    return [`Android`, `IOS`].includes(this.browserItem.winInfo.os)
  }

  /** 最后一次的 token，用于退出登录后中断浏览器打开 */
  #lastToken = ''

  /** 用于重新拉起浏览器 */
  makeBrowserActive!: () => Promise<IBrowser>

  /** 磁盘检测缓存：记录上次检测时间和可用空间 */
  static #lastDiskCheck: { time: number, available: number } | null = null
  /** 磁盘检测计数器：记录距离上次实际检测后的启动次数 */
  static #diskCheckCounter = 0
  /** 上一次的缓存路径 */
  static #lastBrowserCacheRootDir = ''
  /** 上一次的磁盘限制 */
  static #lastDiskLimit = 0

  constructor(private browserItem: BrowserItem) {
    this.#lastToken = store.token!
  }

  /** 开始执行任务 */
  async run() {
    this.taskMap.set($t('内存检测中'), { handler: this.memoryDetection, start: 0, end: 3 })
    this.taskMap.set($t('可用磁盘大小检测中'), { handler: this.diskSizeDetection, start: 3, end: 6 })
    this.taskMap.set(getProxyEntityLabels().detecting, { handler: this.handleProxyDetection, start: 6, end: 10 })
    this.taskMap.set($t('判断是否需要清理浏览器缓存'), { handler: this.clearBrowserCache, start: 10, end: 15 })
    this.taskMap.set($t('同步远程缓存文件'), { handler: this.pullRemoteCacheFiles, start: 15, end: 23 })
    this.taskMap.set($t('导入书签'), { handler: this.importBookmarks, start: 23, end: 25 })
    this.taskMap.set($t('生成指纹配置文件'), { handler: this.createFingerprintConfigFile, start: 25, end: 30 })
    this.taskMap.set($t('检测内核是否可用'), { handler: this.checkKernelAvailability, start: 30, end: 80 })
    this.taskMap.set($t('准备启动浏览器'), { handler: this.launch, start: 80, end: 100 })

    // 不通过的任务会抛出异常，中断任务队列
    for (const [message, task] of this.taskMap) {
      try {
        if (this.#lastToken !== store.token) {
          this.taskMap.clear()
          throw new Error('token is different, interrupt browser open')
        }

        this.currentTask = task
        this.progress = task.start
        this.sendSuccessMessage(message)
        await task.handler.call(this)
        this.progress = task.end
      }
      catch (error) {
        console.error('BeforeLaunchTask run error:', error)
        this.taskMap.clear()
        this.sendErrorMessage(getErrorMessage(error), error)
        return Promise.reject(error)
      }
    }
    // 清空任务队列
    this.taskMap.clear()
    this.currentTask = null
    this.sendSuccessMessage($t('浏览器启动成功'))

    if (this.proxyInfo?.ip) {
      API.window.userMdfWindowInfoSingleV2Create({
        id: this.browserItem.winInfo.id!,
        lastIp: this.proxyInfo.ip,
        lastCountry: this.proxyInfo.country_code,
      }, { headers: this.browserItem.requestHeaders }).then(() => {
        console.log('IP info synced successfully')
      })
    }
  }

  /** 启动浏览器 */
  async launch() {
    const { promise, resolve, reject } = Promise.withResolvers<void>()

    clearTimeout(this.launchTimer)

    // 生成内核启动的命令行参数
    this.launchArgs = await this.genLaunchCLIArgs()
    console.log('launchArgs', this.launchArgs)

    if (this.browserItem.isFirefox) {
      // Firefox 没有 Local State / Preferences / Bookmarks 等 Chrome 概念
      // 标签页由命令行 URL 打开，禁用 session 恢复以免与 CLI 重复开 tab
      await this.prepareFirefoxProfile()
      // 写入登录信息（Firefox 是 lumilogin 文件，由内核启动前还原）
      await this.writeLoginData()
    }
    else {
      // 更新浏览器偏好设置
      await this.updateBrowserPreferences()
      // 写入登录信息
      await this.writeLoginData()
      // 修改浏览器 Local State 文件
      await this.modifyLocalStateFile()
    }

    if (!this.browserItem.isFirefox && !isWindows) {
      await this.cleanupChromiumSingletonFiles()
    }

    this.sendSuccessMessage($t('正在启动浏览器'), this.progress)

    let isTimedOut = false
    let launchProgressTimer: ReturnType<typeof setInterval> | undefined

    /** 停止进度轮询，避免超时/失败后 success 消息覆盖 error 状态导致渲染进程卡在「正在启动浏览器」 */
    const stopLaunchProgress = () => {
      if (launchProgressTimer) {
        clearInterval(launchProgressTimer)
        launchProgressTimer = undefined
      }
    }

    const baseTimeoutMs = 60_000
    // 内核刚落盘首次运行时,杀软实时扫描会显著拖慢进程初始化(实测可达 40s+),放宽超时避免误判失败
    const launchTimeoutMs = this.isFreshCoreInstall ? baseTimeoutMs + 30_000 : baseTimeoutMs

    this.launchTimer = setTimeout(() => {
      isTimedOut = true
      stopLaunchProgress()
      this.sendErrorMessage($t('浏览器启动超时'))
      reject(new Error($t('浏览器启动超时')))
      if (this.browser) {
        this.browser.close().catch(() => {})
        this.browser = null
      }
    }, launchTimeoutMs)

    this.makeBrowserActive = async () => {
      const launchOptions: BrowserLaunchOptions = {
        args: this.launchArgs,
        executablePath: this.exePath,
        headless: false,
        ignoreDefaultArgs: true,
        defaultViewport: null,
        coreType: this.browserItem.coreType,
        userDataDir: this.browserItem.isFirefox ? this.browserItem.userDataDir : undefined,
        // 与外层启动超时对齐,避免底层等待调试端口的超时先于/晚于外层且行为不一致
        timeoutMs: launchTimeoutMs,
      }
      console.log('launchOptions', launchOptions)

      if (!this.browser) {
        let acc = 0
        launchProgressTimer = setInterval(() => {
          if (isTimedOut)
            return
          acc += 0.2
          this.sendSuccessMessage($t('正在启动浏览器'), Math.min(this.progress + acc, 98))
        }, 60)

        this.browser = await launchBrowser(launchOptions).finally(() => {
          stopLaunchProgress()
        })

        if (isTimedOut && this.browser) {
          console.warn('Browser launched successfully but timeout already occurred, closing it immediately to prevent zombie process.')
          this.browser.close().catch(() => {})
          this.browser = null
          return Promise.reject(new Error($t('浏览器启动超时'))) as any
        }

        this.wsEndpoint = this.browser!.wsEndpoint()
        console.log('Browser launched successfully, wsEndpoint:', this.wsEndpoint)
      }
      else if (this.browserItem.isFirefox) {
        // Firefox 同一 profile 再次 spawn 可唤醒已有实例（不能带 URL，否则会开新 tab）
        await launchBrowser({
          ...launchOptions,
          args: ['-profile', this.browserItem.userDataDir],
          relaunch: true,
        }).catch((error) => {
          console.warn('Firefox focus re-launch failed:', error)
        })
      }
      else {
        await launchBrowser({
          ...launchOptions,
          relaunch: true,
        })
      }

      resolve()
      return this.browser!
    }

    // 拉起浏览器
    this.makeBrowserActive().catch((error) => {
      if (!isTimedOut) {
        this.sendErrorMessage($t('浏览器启动失败'), error)
        reject(error)
      }
    }).finally(() => {
      clearTimeout(this.launchTimer)
    })

    return promise
  }

  /** 清理 macOS/Linux 下 Chromium 用户数据目录中的单例锁文件，避免启动时因残留锁导致失败 */
  private async cleanupChromiumSingletonFiles() {
    const singletonFiles = ['SingletonCookie', 'SingletonLock', 'SingletonSocket']
    await Promise.all(singletonFiles.map(async (fileName) => {
      const targetPath = join(this.browserItem.userDataDir, fileName)
      try {
        await rm(targetPath, { force: true })
      }
      catch (error) {
        console.warn(`Failed to delete singleton file: ${targetPath}, ${getErrorMessage(error)}`)
      }
    }))
  }

  /** 将已运行的 Firefox 窗口置于前台（不 spawn 新进程） */
  private async focusExistingFirefoxBrowser() {
    if (!this.browser) {
      return
    }

    try {
      await this.browser.bringToFront?.()
    }
    catch (error) {
      console.warn('focusExistingFirefoxBrowser failed:', error)
    }
  }

  /** 重新连接浏览器 */
  async reconnectBrowser() {
    if (this.wsEndpoint) {
      try {
        this.browser = await connectBrowser({ coreType: this.browserItem.coreType, browserWSEndpoint: this.wsEndpoint })
        console.log('Reconnected to browser successfully')
        return true
      }
      catch (error) {
        console.error('Failed to reconnect to browser:', error)
        return false
      }
    }
  }

  /** 检测内核是否可用 */
  private async checkKernelAvailability() {
    const { coreVersion } = this.browserItem.winInfo

    if (!coreVersion) {
      this.sendErrorMessage($t('没有指定内核版本'))
      throw new Error($t('没有指定内核版本'))
    }

    const coreManagerUtils = coreManager.getCoreManager(this.browserItem.coreType)

    // exe 不存在说明本次启动会触发内核下载/解压,首次运行需放宽启动超时
    this.isFreshCoreInstall = !(await fileExists(coreManagerUtils.genCoreExePath(coreVersion)))

    // 获取内核执行程序路径
    this.exePath = await coreManagerUtils.getCoreExePath(coreVersion, (payload) => {
      if (payload.description && this.currentTask) {
        if (payload.percent) {
          this.progress = this.currentTask.start + ((this.currentTask.end - this.currentTask.start) * (payload.percent / 100))
        }
        this.sendSuccessMessage(payload.description)
      }
    }).catch((error) => {
      this.sendErrorMessage(error.message, error)
      return Promise.reject(error)
    })
  }

  /** 生成内核启动的命令行参数 */
  private async genLaunchCLIArgs(): Promise<string[]> {
    this.deferredOpenUrls = []
    if (this.browserItem.isFirefox) {
      return this.genFirefoxLaunchCLIArgs()
    }
    return this.genChromeLaunchCLIArgs()
  }

  /** 将用户配置的打开 URL 写入启动参数，超出 Windows 命令行长度限制的 URL 延后打开 */
  private appendOpenUrls(args: string[], urls?: string[]): string[] {
    const validUrls = urls?.filter(url => url && this.browserItem.isValidURL(url)) ?? []
    const { args: nextArgs, deferredUrls } = appendOpenUrlsToLaunchArgs(this.exePath, args, validUrls)
    if (deferredUrls.length) {
      this.deferredOpenUrls.push(...deferredUrls)
      console.warn(
        `[BeforeLaunchTask] ${deferredUrls.length} URL(s) deferred due to Windows command line length limit (ENAMETOOLONG)`,
      )
    }
    return nextArgs
  }

  /**
   * 生成 Firefox 启动命令行参数：
   *  ```
   *  RoxyFirefox -profile <data-dir> --remote-debugging-port=0 [user-args] [urls...]
   *  ```
   */
  private async genFirefoxLaunchCLIArgs(): Promise<string[]> {
    const {
      startupParam,
      positionSwitch,
      dirId,
      openWorkbench,
      allOpenUrl,
    } = this.browserItem.winInfo

    const args: string[] = [
      '-profile',
      this.browserItem.userDataDir,
      ...firefoxDefaultCLIArgs,
    ]

    // 窗口大小：全屏用 -maximized，自定义用 -width / -height
    if (!positionSwitch) {
      args.push('-maximized')
    }
    else {
      // if (openWidth)
      //   args.push('-width', String(openWidth))
      // if (openHeight)
      //   args.push('-height', String(openHeight))
    }

    // 用户自定义启动参数（不允许覆盖 -profile / --remote-debugging-port）
    if (startupParam && startupParam.trim?.() !== '') {
      const userCustomArgs = startupParam.split(';')
        .map((item: string) => item.trim())
        .filter((arg: string) => {
          if (!arg)
            return false
          const key = arg.split('=')[0]
          return key !== '-profile' && key !== '--remote-debugging-port'
        })
      args.push(...userCustomArgs)
    }

    // 工作台 URL；附带 workspaceType，旧客户端未下发 appConfig.workspaceType 时仍可识别电商模式
    if (openWorkbench === 1 || (openWorkbench === 2 && store.openWorkbench)) {
      const workspaceType = store.workspaceType ?? 0
      const dashboardUrl = `http://127.0.0.1:${store.appPort}/dashboard.html?id=${dirId}&workspaceType=${workspaceType}`
      args.push(dashboardUrl)
    }

    const nextArgs = this.appendOpenUrls(args, allOpenUrl)
    nextArgs.push('-no-remote')

    return nextArgs.filter(item => item.trim() !== '')
  }

  /** 生成 Chrome 启动命令行参数 */
  private async genChromeLaunchCLIArgs(): Promise<string[]> {
    const {
      dirId,
      sandboxPermission,
      usePluginList,
      startupParam,
      openWidth,
      openHeight,
      allOpenUrl,
      useGpu,
      workspaceId,
      openWorkbench,
      windowRatioPosition,
      positionSwitch,
    } = this.browserItem.winInfo

    const args = [
      ...defaultCLIArgs,
      `--user-data-dir=${this.browserItem.userDataDir}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--password-store=basic',
      '--disable-backgrounding-occluded-windows',
      // `--custom-devtools-frontend=file://${String.raw`D:\work\devtools-133\devtools-frontend\out\Default\gen\front_end`}`,
    ]

    // 临时解决 macOS code_sign_clone 问题
    if (isMac) {
      args.push('--disable-features=MacAppCodeSignClone')
    }

    if (openWorkbench === 1 || (openWorkbench === 2 && store.openWorkbench)) {
      const workspaceType = store.workspaceType ?? 0
      const dashboardUrl = `http://127.0.0.1:${store.appPort}/dashboard.html?id=${dirId}&workspaceType=${workspaceType}`
      args.push(dashboardUrl)
    }

    // 如果用户开启了插件
    if (usePluginList?.length) {
      let acc = 0
      let timer
      const extensionManager = new ExtensionManager({ workspaceId })
      const plugins = await extensionManager.getTargetExtensions(usePluginList, (msg: string) => {
        clearInterval(timer)
        timer = setInterval(() => {
          acc += 0.2
          this.progress = Math.min(this.progress + acc, 90)
          this.sendSuccessMessage(msg)
        }, 60)
      }).catch((error) => {
        this.warningMessages.push($t('获取扩展失败'))
        console.log('Failed to get extensions', error)
        return []
      }).finally(() => {
        clearInterval(timer)
      })
      if (plugins.length) {
        await Promise.allSettled(plugins.map(async (plugin) => {
          const localPath = join(plugin, '_metadata', 'generated_indexed_rulesets')
          console.log('delete plugin', localPath)
          await rm(localPath, { recursive: true, force: true })
        }))
        args.push(`--load-extension=${plugins.join(',')}`)
      }
    }

    // 开启沙盒模式
    if (sandboxPermission) {
      args.push(`--no-sandbox`)
    }

    // 用户自定义启动参数
    if (startupParam && startupParam.trim?.() !== '') {
      const userCustomArgs = startupParam.split(';')
        .map((item: string) => item.trim())
        .filter((arg: string) => {
          // 用户自定义启动参数，除了 --user-data-dir 外，其他参数都允许覆盖内置参数
          const key = arg.split('=')[0]
          const allowOverride = key !== '--user-data-dir'

          // 对于允许覆盖的参数，移除内置的同 key 参数，保留用户自定义的值
          if (allowOverride) {
            const existingIndex = args.findIndex(a => a.split('=')[0] === key)
            if (existingIndex !== -1) {
              args.splice(existingIndex, 1)
            }
          }
          return allowOverride
        })

      args.push(...userCustomArgs)
    }

    // 如果是全屏，则不设置窗口大小
    if (!positionSwitch) {
      args.push('--start-maximized')
    }
    else {
      args.push(`--window-size=${openWidth || 1280},${openHeight || 720}`)

      const virtual = getVirtualWorkAreaUnion()

      // rxRaw 和 ryRaw 是相对于虚拟工作台的百分比，direction 是方向
      const [rxRaw = '0', ryRaw = '0', direction = 'tl'] = windowRatioPosition?.split(',') ?? []
      const xx = virtual.originX + Math.floor(virtual.width * Number(rxRaw))
      const yy = virtual.originY + Math.floor(virtual.height * Number(ryRaw))
      const winWidth = Number(openWidth)
      const winHeight = Number(openHeight)
      let positions: number[] = [xx, yy]
      console.log('virtualWorkArea', virtual)
      console.log('windowRatioPosition', windowRatioPosition, positions)

      if (direction === 'tr') {
        positions = [xx - winWidth, yy]
      }
      else if (direction === 'br') {
        positions = [xx - winWidth, yy - winHeight]
      }
      else if (direction === 'bl') {
        positions = [xx, yy - winHeight]
      }
      console.log('positions', positions)
      args.push(`--window-position=${positions.join(',')}`)
    }

    // 如果是移动端，打开开发者工具
    if (this.isMobile) {
      args.push('--auto-open-devtools-for-tabs')
    }

    // // console.log(`exe_strs`, exe_strs);
    // if (exe_strs.indexOf(data.platformUrl) == -1) {
    //   exe_strs.push(data.platformUrl);
    // }

    if (!useGpu) {
      args.push('--disable-gpu')
    };

    // 用户配置的打开标签页（通过 CLI 打开，确保在 afterLaunchTask 注入 cookie 后 reload 即可生效）
    return this.appendOpenUrls(args, allOpenUrl).filter(item => item.trim() !== '')
  }

  /** 更新浏览器偏好设置 */
  async updateBrowserPreferences() {
    const { preferencesPath, winInfo } = this.browserItem
    const { usePluginList, workspaceId } = winInfo

    try {
      const isExist = await fileExists(preferencesPath)

      if (!isExist) {
        await fileExists(dirname(preferencesPath), true)
        await writeFile(preferencesPath, JSON.stringify({ extensions: { pinned_extensions: [] } }))
      }

      const preferences = JSON.parse(await readFile(preferencesPath, 'utf-8'))

      if (usePluginList?.length) {
        console.log('usePluginList', usePluginList)

        const pinnedExtensions = preferences.extensions?.pinned_extensions || []
        console.log('old pinnedExtensions', pinnedExtensions)
        const extensionManager = new ExtensionManager({ workspaceId })
        console.log('extensionManager.extensionDir', workspaceId, extensionManager.extensionDir)
        for (const extItem of usePluginList) {
          const extID = await getExtensionIDByPath(join(extensionManager.extensionDir, extItem.pluginDir))
          if (extItem.fixedPlugin === 'unpin') {
            const index = pinnedExtensions.findIndex(item => item === extID)
            if (index !== -1) {
              pinnedExtensions.splice(index, 1)
            }
          }
          else if (extItem.fixedPlugin === 'pin' && !pinnedExtensions.includes(extID)) {
            pinnedExtensions.push(extID)
          }
        }
        console.log('new pinnedExtensions', pinnedExtensions)
        preferences.extensions.pinned_extensions = pinnedExtensions
      }

      // 读取上次记录的 colorScheme，仅当发生变化时才更新主题偏好，避免每次启动都无谓写入。
      const colorScheme = store.browserColorScheme || 'system'
      const colorSchemeCachePath = join(this.browserItem.userDataDir, '.roxy_color_scheme')
      const storedColorScheme = (await fileExists(colorSchemeCachePath))
        ? await readFile(colorSchemeCachePath, 'utf-8').catch(() => null)
        : null
      if (storedColorScheme !== colorScheme) {
        preferences.browser ??= {}
        preferences.browser.theme ??= {}
        // 0: 自动, 1: 浅色, 2: 深色
        preferences.browser.theme.color_scheme2 = { system: 0, light: 1, dark: 2 }[colorScheme]
        preferences.browser.theme.color_scheme = preferences.browser.theme.color_scheme2
        // 写入新的 colorScheme 缓存，供下次启动时比对
        await writeFile(colorSchemeCachePath, colorScheme, 'utf-8').catch(err =>
          console.error('Failed to write color scheme cache', err),
        )
      }
      await writeFile(preferencesPath, JSON.stringify(preferences))
    }
    catch (error) {
      console.error('Failed to update browser preferences', error)
    }
  }

  /** 根据代理检测结果决定是否要拉起浏览器 */
  private async handleProxyDetection() {
    const { stopOpenNet, stopOpenIP, stopOpenPosition, lastIp, lastCountry, host } = this.browserItem.winInfo

    // 网络不通停止打开 stopOpenNet
    // IP发生变化停止打开 stopOpenIP
    // IP对应国家 / 地区发生改变停止打开 stopOpenPosition
    try {
      // 检测代理信息
      this.proxyInfo = await this.browserItem.proxyDetection()
    }
    catch (error) {
      console.error('Proxy detection failed', error)
      //  网络不通停止打开
      if (stopOpenNet) {
        return Promise.reject(new Error($t('网络不通停止打开')))
      }

      const labels = getProxyEntityLabels()
      const message = this.browserItem.winInfo.buyProxyType === 1 ? labels.cannotConnect : labels.detectFailed

      if (host) {
        this.warningMessages.push(message)
      }
    }

    // IP发生变化停止打开
    if (stopOpenIP) {
      if (lastIp && this.proxyInfo.ip !== lastIp) {
        return Promise.reject(new Error($t('IP发生变化停止打开')))
      }
    }
    // IP对应国家 / 地区发生改变停止打开
    if (stopOpenPosition) {
      if (lastCountry && this.proxyInfo.country_code !== lastCountry) {
        return Promise.reject(new Error($t('IP对应国家 / 地区发生改变停止打开')))
      }
    }
  }

  /** 创建指纹配置文件 */
  private async createFingerprintConfigFile() {
    // TODO: 仅当用户选择`基于IP匹配`时，才去校准时区
    // if (this.browserItem.winInfo.isTimeZone) {
    //   try {
    //     const timezone = await getTimezoneByCity(this.proxyInfo.city, this.proxyInfo.country_code)
    //     this.proxyInfo.timezone = timezone || this.proxyInfo.timezone;
    //   } catch (error) {
    //     console.error('获取时区失败', error)
    //   }
    // }

    // 按内核生成对应形状的指纹配置；userDataDir 用于 Firefox 图标缓存路径
    const fingerprintConfig = await genFingerprintConfig(this.browserItem.winInfo, this.proxyInfo, this.browserItem.userDataDir)

    if (!this.browserItem.winInfo.isDirect) {
      console.log('fingerprintConfig fproxy', fingerprintConfig.fproxy)
    }

    try {
      await fileExists(dirname(this.browserItem.fingerprintConfigPath), true)
      // TODO: 测试阶段暂时用明文的
      // if (this.browserItem.isFirefox) {
      //   const content = JSON.stringify(fingerprintConfig, null, 2)
      //   await writeFile(join(this.browserItem.userDataDir, 'fingerprint.json'), content)
      // }
      // else {
      const content = encryptFingerprintConfig(JSON.stringify(fingerprintConfig))
      await writeFile(this.browserItem.fingerprintConfigPath, content)
      // }
    }
    catch (error) {
      console.error('Failed to create fingerprint config file', error)
      return Promise.reject(new Error($t('创建指纹配置文件失败')))
    }
  }

  /** 导入书签 */
  private async importBookmarks() {
    if (!this.browserItem.winInfo.openBookmarks) {
      return
    }

    try {
      if (this.browserItem.isFirefox) {
        await importBookmarks({
          bookmarkPath: join(this.browserItem.userDataDir, 'places.sqlite'),
          isFirefox: true,
        })
        return
      }

      await importBookmarks({
        bookmarkPath: join(this.browserItem.userDataDir, 'Default', 'Bookmarks'),
        preferencesPath: this.browserItem.preferencesPath,
      })
    }
    catch (error) {
      console.error('Failed to import bookmarks', error)
    }
  }

  /** 拉取远程缓存文件 */
  private async pullRemoteCacheFiles() {
    const { version: remoteVersion, fileCount } = this.browserItem.winInfo.syncValue as Record<string, any>

    //  如果没有远程版本号，不拉取
    if (!remoteVersion) {
      console.log('No remote version, skipping pull')
      return
    }

    // 如果文件数量为零，不拉取
    if (fileCount === 0) {
      console.log('No remote file count, skipping pull')
      return
    }

    const localVersion = await fileExists(this.browserItem.ossCacheVersionPath)
      ? await readFile(this.browserItem.ossCacheVersionPath, 'utf-8')
      : 0

    console.log('localVersion', localVersion)
    console.log('remoteVersion', remoteVersion)

    // 如果本地版本大于等于远程版本，不拉取
    if (Number(localVersion) >= Number(remoteVersion)) {
      console.log('Local version >= remote version, skipping pull')
      return
    }

    const remoteCacheFilePath = `${this.browserItem.winInfo.ossDirPath}${this.browserItem.browserCacheFileName}`
    const localCacheFilePath = join(this.browserItem.ossCacheDir, this.browserItem.browserCacheFileName)

    try {
      await fileExists(dirname(localCacheFilePath), true)
      console.log('Starting to pull remote cache files', remoteCacheFilePath)
      // 下载远程缓存文件
      await aliOSS.get(remoteCacheFilePath, localCacheFilePath, { workspaceId: this.browserItem.winInfo.workspaceId })
      console.log('Remote cache files downloaded successfully', localCacheFilePath)
      // 解压缓存文件
      await fileOperations.executeTask('decompress', {
        src: localCacheFilePath,
        dest: this.browserItem.userDataDir,
        filters: this.browserItem.needSyncFiles.map(path => path.slice(1)),
      })
      console.log('Cache files decompressed successfully', localCacheFilePath)

      console.log('ossCacheVersionPath', this.browserItem.ossCacheVersionPath)
      writeFile(this.browserItem.ossCacheVersionPath, String(remoteVersion))
    }
    catch (error) {
      console.error('Failed to sync remote cache files', error)
      this.warningMessages.push($t('同步远程缓存文件失败'))
      // return Promise.reject(error)
    }
  }

  /**
   * 写入 Firefox user.js，禁止启动时恢复 session。
   * Roxy 通过命令行 URL / roxy_tabs 管理标签页；若 profile 中 browser.startup.page=3，
   * 会与 CLI 同时恢复上次标签，导致偶发重复 tab。
   */
  private async prepareFirefoxProfile() {
    const profileDir = this.browserItem.userDataDir
    try {
      await fileExists(profileDir, true)

      // 禁止 Firefox 启动时恢复上次 session，避免与 CLI URL 重复开 tab
      const userJsPath = join(profileDir, 'user.js')
      const { useGpu, sandboxPermission } = this.browserItem.winInfo
      const managedPrefs: string[] = [
        '// Roxy Browser managed preferences',
        // 保持后台 Firefox profile 可响应 BiDi 合成点击，并避免后台渲染/计时器节流影响自动化。
        ...firefoxBackgroundAutomationPrefs,
        // page=1：启动时显示主页（对应设置 → 主页 → 主页和新窗口 = "Firefox 主页（默认）"）
        // 不使用 page=3，避免 session 恢复与 CLI URL 重复开 tab
        // 'user_pref("browser.startup.page", 1);',
        // 主页 URL 指向官方 Activity Stream（about:home）
        'user_pref("browser.startup.homepage", "about:home");',
        // 'user_pref("browser.sessionstore.resume_from_crash", false);',
        // 新标签页使用官方 Firefox 主页（Activity Stream），对应设置 → 主页 → 新标签页 = "Firefox 主页（默认）"
        'user_pref("browser.newtabpage.enabled", true);',
      ]

      // 硬件加速：useGpu=false 时禁用（等同于 Chrome 的 --disable-gpu）
      if (!useGpu) {
        managedPrefs.push('user_pref("layers.acceleration.disabled", true);')
        managedPrefs.push('user_pref("gfx.webrender.disabled", true);')
      }
      else {
        managedPrefs.push('user_pref("layers.acceleration.disabled", false);')
        managedPrefs.push('user_pref("gfx.webrender.disabled", false);')
      }

      // 沙盒：sandboxPermission=true 时禁用内容沙盒（等同于 Chrome 的 --no-sandbox）
      if (sandboxPermission) {
        managedPrefs.push('user_pref("security.sandbox.content.level", 0);')
      }
      else {
        // 恢复 Firefox 默认沙盒等级（Windows 默认 4，其他平台默认 3）
        managedPrefs.push('user_pref("security.sandbox.content.level", -1);')
      }

      // 颜色主题：
      // layout.css.prefers-color-scheme.content-override 控制网页 prefers-color-scheme 媒体查询
      //   0 = 强制暗色，1 = 强制浅色，2 = 跟随系统（Firefox 默认）
      // ui.systemUsesDarkTheme 覆盖 Firefox 对操作系统明暗模式的感知，控制浏览器 UI 自身的明暗
      //   -1 = 跟随系统（重置，Firefox 只识别 0/1，其余值回退到 OS 感知）
      //   0 = 强制浅色，1 = 强制深色
      // 注意：browser.theme.content-theme / browser.theme.toolbar-theme 是主题引擎计算后写入的只读值，
      //       无法通过 user.js 或 prefs.js 覆盖，Firefox 启动时会根据激活主题重新覆盖它们。
      const colorScheme = store.browserColorScheme || 'system'

      if (colorScheme !== 'system') {
        // 网页内容的明暗感知：dark=0，light=1
        const contentOverride = colorScheme === 'dark' ? 0 : 1
        managedPrefs.push(`user_pref("layout.css.prefers-color-scheme.content-override", ${contentOverride});`)
        // 浏览器 UI 明暗：dark=1，light=0
        const uiDarkTheme = colorScheme === 'dark' ? 1 : 0
        managedPrefs.push(`user_pref("ui.systemUsesDarkTheme", ${uiDarkTheme});`)
      }
      else {
        // 跟随系统时，网页内容的 prefers-color-scheme 媒体查询恢复跟随 OS（2 = follow system）
        managedPrefs.push('user_pref("layout.css.prefers-color-scheme.content-override", 2);')
        // 注意：不在 user.js 中设置 ui.systemUsesDarkTheme。
        // 该 pref 只要存在于 prefs.js 就会覆盖系统主题感知，且 user.js 只能 SET 不能 DELETE；
        // 遗留值的清除由 applyFirefoxThemeToExtensionsJson 直接编辑 prefs.js 完成。
      }

      const activeThemeID = colorScheme === 'dark' ? 'firefox-compact-dark@mozilla.org' : colorScheme === 'light' ? 'firefox-compact-light@mozilla.org' : 'default-theme@mozilla.org'
      managedPrefs.push(`user_pref("extensions.activeThemeID", "${activeThemeID}");`)

      await writeFile(userJsPath, `${managedPrefs.join('\n')}\n`)

      // 读取上次记录的 colorScheme，仅当发生变化时才修改 extensions.json 并删除 addon 启动缓存。
      // 避免每次启动都重建 addon 状态，减少不必要的 I/O 开销。
      const colorSchemeCachePath = join(profileDir, '.roxy_color_scheme')
      const storedColorScheme = (await fileExists(colorSchemeCachePath))
        ? await readFile(colorSchemeCachePath, 'utf-8').catch(() => null)
        : null
      if (storedColorScheme !== colorScheme) {
        // 修改 extensions.json，将目标主题标记为激活状态。
        // Firefox 主题系统以 extensions.json 中的 active/userDisabled 字段为权威来源，
        // 优先级高于 user.js 里的 extensions.activeThemeID 偏好值；
        // 只有同时更新此文件，浏览器 UI 主题才能真正生效（仅对已存在的 profile 有效）。
        await this.applyFirefoxThemeToExtensionsJson(profileDir, activeThemeID)
        // 写入新的 colorScheme 缓存，供下次启动时比对
        await writeFile(colorSchemeCachePath, colorScheme, 'utf-8').catch(err =>
          console.error('Failed to write color scheme cache', err),
        )
      }

      // 写入 xulstore.json 设置 Firefox 窗口初始位置
      // Firefox 不支持 --window-position CLI 参数，通过 profile 内的 xulstore.json 实现
      await this.writeFirefoxWindowPosition(profileDir)
    }
    catch (error) {
      console.error('Failed to prepare Firefox profile:', error)
    }
  }

  /**
   * 修改 profile 目录下的 extensions.json，将指定主题标记为激活状态。
   *
   * Firefox AddonManager 的主题状态读取优先级：
   *   addonStartup.json.lz4（LZ4 压缩启动缓存）> extensions.json
   * 上次正常启动后，Firefox 会将当前 addon 状态写入 addonStartup.json.lz4，
   * 下次启动时优先使用该缓存，导致对 extensions.json 的外部修改被忽略（二次启动不生效问题）。
   * 解决方法：修改 extensions.json 后同时删除 addonStartup.json.lz4，
   * 迫使 Firefox 在下次启动时从 extensions.json 重建 addon 状态。
   *
   * 只对已有 profile（extensions.json 已存在）有效；首次启动的全新 profile
   * 不存在此文件，由 user.js 里的 extensions.activeThemeID 兜底。
   */
  private async applyFirefoxThemeToExtensionsJson(profileDir: string, activeThemeID: string) {
    const extensionsJsonPath = join(profileDir, 'extensions.json')
    if (!(await fileExists(extensionsJsonPath))) {
      // 全新 profile，extensions.json 尚未生成，user.js 偏好值会在首次启动时生效
      return
    }
    try {
      const extensionsJson = JSON.parse(await readFile(extensionsJsonPath, 'utf-8'))
      /** Firefox 内置的三个 UI 主题 ID */
      const builtinThemeIds = new Set([
        'default-theme@mozilla.org',
        'firefox-compact-light@mozilla.org',
        'firefox-compact-dark@mozilla.org',
      ])
      if (Array.isArray(extensionsJson.addons)) {
        for (const addon of extensionsJson.addons) {
          if (builtinThemeIds.has(addon.id)) {
            const isTarget = addon.id === activeThemeID
            // active=true + userDisabled=false 表示该主题被激活
            addon.active = isTarget
            addon.userDisabled = !isTarget
          }
        }
      }
      await writeFile(extensionsJsonPath, JSON.stringify(extensionsJson))
      console.log('Applied Firefox theme in extensions.json:', activeThemeID)

      // 删除 addon 启动缓存，迫使 Firefox 从 extensions.json 重建状态。
      // 若不删除，Firefox 会在二次及后续启动时优先读取此 LZ4 缓存，
      // 导致对 extensions.json 的修改被忽略，主题切换不生效。
      const addonStartupCachePath = join(profileDir, 'addonStartup.json.lz4')
      if (await fileExists(addonStartupCachePath)) {
        await rm(addonStartupCachePath, { force: true })
        console.log('Deleted addonStartup.json.lz4 to invalidate addon startup cache')
      }

      // 恢复系统主题时，从 prefs.js 中删除 ui.systemUsesDarkTheme。
      // 该 pref 只要存在于 prefs.js 就会直接被 Firefox 使用（覆盖 OS 检测）；
      // 没有任何"跟随系统"的有效值——唯一的方法是让该 pref 不存在。
      // user.js 只能写入/覆盖 pref，无法删除已有项，因此必须直接编辑 prefs.js。
      if (activeThemeID === 'default-theme@mozilla.org') {
        const prefsJsPath = join(profileDir, 'prefs.js')
        if (await fileExists(prefsJsPath)) {
          const prefsContent = await readFile(prefsJsPath, 'utf-8')
          const cleaned = prefsContent
            .split('\n')
            .filter(line => !line.includes('"ui.systemUsesDarkTheme"'))
            .join('\n')
          if (cleaned !== prefsContent) {
            await writeFile(prefsJsPath, cleaned, 'utf-8')
            console.log('Removed ui.systemUsesDarkTheme from prefs.js to restore OS theme detection')
          }
        }
      }
    }
    catch (err) {
      console.error('Failed to update extensions.json for theme', err)
    }
  }

  /**
   * 将窗口位置写入 Firefox profile 的 xulstore.json。
   * xulstore.json 格式：
   * { "chrome://browser/content/browser.xhtml": { "main-window": { "screenX": "100", "screenY": "100", "sizemode": "normal" } } }
   */
  private async writeFirefoxWindowPosition(profileDir: string) {
    const { positionSwitch, openWidth, openHeight, windowRatioPosition } = this.browserItem.winInfo
    const xulstorePath = join(profileDir, 'xulstore.json')

    // 读取已有 xulstore.json，不存在则初始化为空对象
    let xulstore: Record<string, any> = {}
    try {
      const raw = await readFile(xulstorePath, 'utf-8')
      xulstore = JSON.parse(raw)
    }
    catch {
      // 文件不存在或解析失败，从空对象开始
    }

    const windowKey = 'chrome://browser/content/browser.xhtml'
    xulstore[windowKey] ??= {}
    const win = xulstore[windowKey]['main-window'] ?? {}

    if (!positionSwitch) {
      // 全屏模式
      win.sizemode = 'maximized'
    }
    else {
      win.sizemode = 'normal'
      if (openWidth)
        win.width = String(openWidth)
      if (openHeight)
        win.height = String(openHeight)

      // 计算绝对像素坐标（复用 Chrome 的虚拟工作台逻辑）
      const virtual = getVirtualWorkAreaUnion()
      const [rxRaw = '0', ryRaw = '0', direction = 'tl'] = windowRatioPosition?.split(',') ?? []
      let xx = virtual.originX + Math.floor(virtual.width * Number(rxRaw))
      let yy = virtual.originY + Math.floor(virtual.height * Number(ryRaw))
      const winWidth = Number(openWidth) || 0
      const winHeight = Number(openHeight) || 0

      if (direction === 'tr') {
        xx = xx - winWidth
      }
      else if (direction === 'br') {
        xx = xx - winWidth
        yy = yy - winHeight
      }
      else if (direction === 'bl') {
        yy = yy - winHeight
      }

      win.screenX = String(xx)
      win.screenY = String(yy)
    }

    xulstore[windowKey]['main-window'] = win
    await writeFile(xulstorePath, JSON.stringify(xulstore))
  }

  /** 写入登录信息 */
  private async writeLoginData() {
    const { lumiLogin } = this.browserItem.winInfo

    if (lumiLogin) {
      try {
        const defaultDir = join(this.browserItem.userDataDir, 'Default')
        await fileExists(defaultDir, true)
        await writeFile(this.browserItem.lumiLoginPath, lumiLogin, 'utf8')
        console.log('LumiLogin written successfully')
      }
      catch (error) {
        this.warningMessages.push($t('登录信息写入失败'))
        console.error('Failed to write LumiLogin', error)
      }
    }
  }

  /** 修改浏览器 Local State 文件 */
  async modifyLocalStateFile() {
    const { roxyLocalStatePath } = this.browserItem
    let localState: Record<string, any> = {}
    try {
      const isExist = await fileExists(roxyLocalStatePath)

      if (isExist) {
        const content = await readFile(roxyLocalStatePath, 'utf-8')
        localState = JSON.parse(content)
      }
      else {
        await fileExists(dirname(roxyLocalStatePath), true)
      }
      // 不允许 Chrome 在窗口全部关闭后仍保持后台运行（比如某些扩展或服务）
      localState.background_mode = { enabled: false }
      // 136 版本之前，支持强制网页使用暗色模式
      if (Number(this.browserItem.winInfo.coreVersion) < 136) {
        const isDark = store.browserColorScheme === 'dark'
        // 是否强制网页使用暗色模式
        const experiments = isDark ? ['enable-force-dark@1'] : []
        localState.browser = {
          ...localState.browser,
          enabled_labs_experiments: [...(localState.browser?.enabled_labs_experiments || []), ...experiments],
        }
        if (!isDark) {
          localState.browser.enabled_labs_experiments = localState.browser.enabled_labs_experiments?.filter(item => item !== 'enable-force-dark@1')
        }
      }
      await writeFile(roxyLocalStatePath, JSON.stringify(localState))
    }
    catch (error) {
      console.error('Failed to modify Local State file', error)
    }
  }

  /** 根据用户设置，是否要清除浏览器缓存 */
  async clearBrowserCache() {
    if (this.browserItem.isFirefox) {
      return this.clearFirefoxCache()
    }
    return this.clearChromeCache()
  }

  /** 清除 Firefox 缓存 */
  private async clearFirefoxCache() {
    const { clearCookie, clearLocalStorage, clearCacheFile } = this.browserItem.winInfo
    const profileDir = this.browserItem.userDataDir

    if (clearCacheFile) {
      // 删 profile 根除 firefoxCacheToKeep（扩展相关）之外的内容
      try {
        if (await fileExists(profileDir)) {
          const entries = await readdir(profileDir)
          await Promise.all(entries
            .filter(name => !(firefoxCacheToKeep as readonly string[]).includes(name))
            .map(name => rm(join(profileDir, name), { recursive: true, force: true })))
          console.log('Firefox profile cache cleared (except extensions):', profileDir)
        }
      }
      catch (err) {
        console.log('Firefox profile cache clear failed', err)
      }
      return
    }

    if (clearCookie) {
      const cookieFiles = ['cookies.sqlite', 'cookies.sqlite-wal', 'cookies.sqlite-shm']
      for (const f of cookieFiles) {
        const fp = join(profileDir, f)
        if (await fileExists(fp)) {
          try {
            await rm(fp, { force: true })
            console.log('Firefox cookie file deleted:', fp)
          }
          catch (err) {
            this.warningMessages.push($t('cookie文件删除失败'))
            console.log('Firefox cookie file deletion failed', err)
          }
        }
      }
    }

    if (clearLocalStorage) {
      const storageDir = join(profileDir, 'storage', 'default')
      if (await fileExists(storageDir)) {
        try {
          await rm(storageDir, { recursive: true, force: true })
          console.log('Firefox localStorage deleted:', storageDir)
        }
        catch (err) {
          this.warningMessages.push($t('localStorage文件删除失败'))
          console.log('Firefox localStorage deletion failed', err)
        }
      }
    }
  }

  /** 清除 Chrome 缓存 */
  private async clearChromeCache() {
    const { clearCookie, clearLocalStorage, clearCacheFile } = this.browserItem.winInfo

    if (clearCacheFile) {
      const cacheFilePath = this.browserItem.userDataDir
      try {
        await rm(cacheFilePath, { recursive: true, force: true })
        console.log('cacheFilePath deleted successfully', cacheFilePath)
      }
      catch (err) {
        // console.log(`cacheFilePath 删除失败`, err)
        // this.warningMessages.push('缓存文件删除失败')
      }
    }
    else {
      // 当清空缓存先删除cookie文件
      console.log(`Clear cookies: ${clearCookie}`)
      if (clearCookie) {
        const cookieFilePath = join(
          this.browserItem.userDataDir,
          'Default',
          'Network',
          'Cookies',
        )

        if (await fileExists(cookieFilePath)) {
          try {
            console.log('cookieFilePath: ', cookieFilePath)
            await rm(cookieFilePath, { recursive: true })
            console.log('cookieFilePath deleted successfully')
          }
          catch (err) {
            this.warningMessages.push($t('cookie文件删除失败'))
            console.log(`cookieFilePath deletion failed`, err)
          }
        }
      }
      console.log(`Clear localStorage: ${clearLocalStorage}`)
      // 当清空缓存先删除
      if (clearLocalStorage) {
        const localStorageFilePath = join(
          this.browserItem.userDataDir,
          'Default',
          'Local Storage',
        )

        if (await fileExists(localStorageFilePath)) {
          try {
            console.log('localStorageFilePath: ', localStorageFilePath)
            await rm(localStorageFilePath, { recursive: true })
            console.log('localStorage_fileUrl deleted successfully', localStorageFilePath)
          }
          catch (err) {
            console.log(`localStorage_fileUrl deletion failed`, err)
            this.warningMessages.push($t('localStorage文件删除失败'))
          }
        }
      }
    }
  }

  /** 内存检测 */
  private async memoryDetection() {
    let memoryUsageRate: number

    if (isMac) {
      return
    }

    if (isLinux) {
      // Linux 上 process.getSystemMemoryInfo().free 对应 MemFree，
      // 不包含可回收的 cache/buffer，会导致使用率虚高，需要用 MemAvailable
      const meminfo = await readFile('/proc/meminfo', 'utf-8')
      const totalMatch = meminfo.match(RE_MEM_TOTAL)
      const availableMatch = meminfo.match(RE_MEM_AVAILABLE)
      if (!totalMatch || !availableMatch) {
        return
      }
      const total = Number(totalMatch[1])
      const available = Number(availableMatch[1])
      memoryUsageRate = ((total - available) / total) * 100
    }
    else {
      // Windows 和 macOS 上 free 准确反映可用内存（单位 KB）
      const { free, total } = process.getSystemMemoryInfo()
      memoryUsageRate = ((total - free) / total) * 100
    }

    if (memoryUsageRate > store.memoryLimit) {
      const tips = $t('启动失败，内存使用率超出 {memoryLimit}%', { memoryLimit: store.memoryLimit })
      throw new Error(tips)
    }
  }

  private async diskSizeDetection() {
    const now = Date.now()
    /**
     * 每次启动预估占用 100MB
     */
    const estimatedUsagePerLaunch = 100 * 1024 * 1024

    // 如果有缓存的检测结果，判断是否需要跳过本次检测
    if (BeforeLaunchTask.#lastDiskCheck && BeforeLaunchTask.#lastBrowserCacheRootDir === store.browserCacheRootDir && BeforeLaunchTask.#lastDiskLimit === store.diskLimit) {
      const { time, available } = BeforeLaunchTask.#lastDiskCheck
      const timeSinceLastCheck = now - time
      // 预估当前可用空间 = 上次检测的可用空间 - (启动次数 × 单次占用)
      const estimatedAvailable = available - (BeforeLaunchTask.#diskCheckCounter * estimatedUsagePerLaunch)
      // 根据剩余空间决定检测策略（空间越充足，检测越不频繁）
      /**
       * 时间间隔（毫秒）
       */
      let checkInterval = 0
      /**
       * 启动次数阈值
       */
      let checkCounterThreshold = 1

      if (estimatedAvailable > 50 * 1024 ** 3) { // > 50GB
        checkInterval = 30 * 60 * 1000 // 30 分钟检测一次
        checkCounterThreshold = 20 // 或每20次启动检测一次
      }
      else if (estimatedAvailable > 20 * 1024 ** 3) { // > 20GB
        checkInterval = 10 * 60 * 1000 // 10 分钟检测一次
        checkCounterThreshold = 12 // 或每 12 次启动检测一次
      }
      else if (estimatedAvailable > 10 * 1024 ** 3) { // > 10GB
        checkInterval = 5 * 60 * 1000 // 5 分钟检测一次
        checkCounterThreshold = 8 // 或每 8 次启动检测一次
      }
      // <= 10GB 时每次都检测（checkInterval = 0, checkCounterThreshold = 1）

      // 如果时间和次数都未达到阈值，且预估空间仍然充足，跳过实际检测
      if (timeSinceLastCheck < checkInterval && BeforeLaunchTask.#diskCheckCounter < checkCounterThreshold) {
        BeforeLaunchTask.#diskCheckCounter++

        // 预估的可用空间仍然满足要求
        if (estimatedAvailable / (1024 ** 3) >= store.diskLimit) {
          console.log(`Skipping disk check (counter: ${BeforeLaunchTask.#diskCheckCounter}, estimated: ${(estimatedAvailable / (1024 ** 3)).toFixed(2)}GB)`)
          return Promise.resolve()
        }
      }
    }

    // 执行实际的磁盘检测
    const disk = await getDiskInfoByPath(store.browserCacheRootDir)

    // 更新检测缓存和计数器
    BeforeLaunchTask.#lastDiskCheck = {
      time: now,
      available: disk?.available || 0,
    }
    BeforeLaunchTask.#diskCheckCounter = 0
    BeforeLaunchTask.#lastBrowserCacheRootDir = store.browserCacheRootDir
    BeforeLaunchTask.#lastDiskLimit = store.diskLimit

    if (disk?.available && disk?.available / (1024 ** 3) < store.diskLimit) {
      const tips = $t('启动失败，磁盘空间不足，请清理磁盘空间')
      return Promise.reject(new Error(`ERR101: ${tips}`))
    }

    console.log(`Disk check completed (available: ${(disk?.available / (1024 ** 3)).toFixed(2)}GB)`)
    return Promise.resolve()
  }

  /** 发送成功的消息到渲染进程 */
  sendSuccessMessage(message: string, percent = this.progress) {
    if (this.#lastToken !== store.token) {
      browserManager.openingBrowserMap.delete(this.browserItem.winInfo.dirId!)
      this.taskMap.clear()
    }
    else {
      this.lastMessage = {
        dirId: this.browserItem.winInfo.dirId!,
        percent,
        message,
        warningMessages: this.warningMessages,
      }
      sendSuccessMessage(this.lastMessage)
    }
  }

  /** 发送错误的消息到渲染进程 */
  private sendErrorMessage(message: string, error?: any) {
    sendErrorMessage(message, this.browserItem.winInfo.dirId!, error)
  }
}
