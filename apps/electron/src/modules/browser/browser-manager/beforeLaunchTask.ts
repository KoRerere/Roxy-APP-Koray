import type { BrowserItem } from './browserItem'
import type { BrowserLaunchOptions, IBrowser } from '/@/modules/browser/browser-manager/adapter'
import type { proxyDetection } from '/@/utils'
import { screen } from 'electron'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { API } from '/@/api'
import { appConfig } from '/@/constants'
import { isLinux, isMac } from '/@/constants/common'
import { browserManager, coreManager } from '/@/modules/browser'
import { connectBrowser, launchBrowser } from '/@/modules/browser/browser-manager/adapter'
import { defaultCLIArgs } from '/@/modules/browser/browser-manager/constants'
import { sendErrorMessage, sendSuccessMessage } from '/@/modules/browser/browser-manager/message'
import { ExtensionManager } from '/@/modules/extension'
import { genExtensionID, getExtensionIDByPath } from '/@/modules/extension/helper'
import { fileOperations } from '/@/modules/fileOperations'
import { store } from '/@/modules/store'
import { aliOSS, fileExists, getDiskInfoByPath, getErrorMessage } from '/@/utils'
import { encryptFingerprintConfig, genFingerprintConfig, getTimezoneByCity, importBookmarks } from './utils'

const RE_MEM_TOTAL = /MemTotal:\s+(\d+)/
const RE_MEM_AVAILABLE = /MemAvailable:\s+(\d+)/

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
    this.taskMap.set($t('代理 IP 检测中'), { handler: this.handleProxyDetection, start: 6, end: 10 })
    this.taskMap.set($t('判断是否需要清理浏览器缓存'), { handler: this.clearBrowserCache, start: 10, end: 15 })
    this.taskMap.set($t('同步远程缓存文件'), { handler: this.pullRemoteCacheFiles, start: 15, end: 25 })
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

    // 更新浏览器偏好设置
    await this.updateBrowserPreferences()
    // 写入登录信息
    await this.writeLoginData()
    // 修改浏览器 Local State 文件
    await this.modifyLocalStateFile()
    // 导入书签
    await this.importBookmarks().catch((error) => {
      console.error('Failed to import bookmarks', error)
    })

    this.sendSuccessMessage($t('正在启动浏览器'), this.progress)

    let isTimedOut = false

    this.launchTimer = setTimeout(() => {
      isTimedOut = true
      this.sendErrorMessage($t('浏览器启动超时'))
      reject(new Error($t('浏览器启动超时')))
      if (this.browser) {
        this.browser.close().catch(() => {})
        this.browser = null
      }
    }, 30.1 * 1000)

    this.makeBrowserActive = async () => {
      const launchOptions: BrowserLaunchOptions = {
        args: this.launchArgs,
        executablePath: this.exePath,
        headless: false,
        ignoreDefaultArgs: true,
        defaultViewport: null,
        browserType: this.browserItem.winInfo.browserType,
      }
      console.log('launchOptions', launchOptions)
      let timer

      if (!this.browser) {
        let acc = 0
        timer = setInterval(() => {
          acc += 0.2
          this.sendSuccessMessage($t('正在启动浏览器'), Math.min(this.progress + acc, 98))
        }, 60)

        this.browser = await launchBrowser(launchOptions).finally(() => {
          clearInterval(timer)
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
      else {
        await launchBrowser({
          ...launchOptions,
          relaunch: true,
        }).finally(() => {
          clearInterval(timer)
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

  /** 重新连接浏览器 */
  async reconnectBrowser() {
    if (this.wsEndpoint) {
      try {
        this.browser = await connectBrowser({ browserType: 'chrome', browserWSEndpoint: this.wsEndpoint })
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
    const { coreVersion, browserType } = this.browserItem.winInfo

    if (!coreVersion) {
      this.sendErrorMessage($t('没有指定内核版本'))
      throw new Error($t('没有指定内核版本'))
    }

    // 获取内核执行程序路径
    this.exePath = await coreManager.getCoreManager(browserType).getCoreExePath(coreVersion, (payload) => {
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
    const {
      dirId,
      sandboxPermission,
      usePluginList,
      startupParam,
      openWidth,
      openHeight,
      os,
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
      args.push(`data:text/html,`)
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

    /** 内置命令行参数 keys */
    const builtInArgKeys = args.map(arg => arg.split('=')[0])

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

      const primaryDisplay = screen.getPrimaryDisplay()
      const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

      const [x = 0, y = 0, direction = 'tl'] = windowRatioPosition?.split(',') || []
      const xx = Math.floor(screenWidth * x)
      const yy = Math.floor(screenHeight * y)
      const winWidth = Number(openWidth)
      const winHeight = Number(openHeight)
      let positions = [xx, yy]
      console.log('screenWidth', screenWidth, 'screenHeight', screenHeight)
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

    // 开启同步标签页后，同步标签页
    // void (allOpenUrl.slice(0, 1) || []).forEach((item) => {
    //   if (item && this.browserItem.isValidURL(item)) {
    //     args.push(item)
    //   }
    // })

    return args.filter(item => item.trim() !== '')
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

      preferences.browser ??= {}
      preferences.browser.theme ??= {}
      // 0: 自动, 1: 浅色, 2: 深色
      preferences.browser.theme.color_scheme2 = {
        system: 0,
        light: 1,
        dark: 2,
      }[store.browserColorScheme || 'system']
      preferences.browser.theme.color_scheme = preferences.browser.theme.color_scheme2
      await writeFile(preferencesPath, JSON.stringify(preferences))
    }
    catch (error) {
      console.error('Failed to update browser preferences', error)
    }
  }

  /** 根据代理检测结果决定是否要拉起浏览器 */
  private async handleProxyDetection() {
    const { stopOpenNet, stopOpenIP, stopOpenPosition, lastIp, lastCountry } = this.browserItem.winInfo

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

      const message = this.browserItem.winInfo.buyProxyType === 1 ? $t('无法连接至代理 IP，请检查您当前的网络环境并重试。') : $t('代理 IP 检测失败')
      this.warningMessages.push(message)
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

    // 生成指纹配置
    const fingerprintConfig = await genFingerprintConfig(this.browserItem.winInfo, this.proxyInfo)
    console.log('fingerprintConfig fproxy', fingerprintConfig.fproxy)
    try {
      await fileExists(dirname(this.browserItem.fingerprintConfigPath), true)
      const content = encryptFingerprintConfig(JSON.stringify(fingerprintConfig))
      await writeFile(this.browserItem.fingerprintConfigPath, content)
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

    const bookmarkPath = join(this.browserItem.userDataDir, 'Default', 'Bookmarks')
    await importBookmarks(bookmarkPath, this.browserItem.preferencesPath)
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
