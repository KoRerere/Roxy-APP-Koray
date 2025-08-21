import type { Browser, PuppeteerLaunchOptions } from './chrome-wrapper/'
import { screen } from 'electron'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import puppeteer from './chrome-wrapper/'
import type { proxyDetection } from '/@/utils'
import { API } from '/@/api'
import { browserManager, chromeCoreManager } from '/@/modules/browser'
import { defaultCLIArgs } from '/@/modules/browser/browser-manager/constants'
import { sendErrorMessage, sendSuccessMessage } from '/@/modules/browser/browser-manager/message'
import { ExtensionManager } from '/@/modules/extension'
import { fileOperations } from '/@/modules/fileOperations'
import { store } from '/@/modules/store'
import { aliOSS, fileExists, getErrorMessage } from '/@/utils'
import type { BrowserItem } from './browserItem'
import { encryptFingerprintConfig, genFingerprintConfig, importBookmarks, getTimezoneByCity } from './utils'
import { genExtensionID, getExtensionIDByPath } from '/@/modules/extension/helper'

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
  browser: Browser | null = null
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
  makeBrowserActive!: () => Promise<Browser>

  constructor(private browserItem: BrowserItem) {
    this.#lastToken = store.token!
  }

  /** 开始执行任务 */
  async run() {
    this.taskMap.set($t('内存检测中'), { handler: this.memoryDetection, start: 0, end: 5 })
    this.taskMap.set($t('代理检测中'), { handler: this.handleProxyDetection, start: 5, end: 10 })
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
          throw new Error('用户凭证不一样，中断浏览器打开')
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
        console.log('同步ip信息成功')
      })
    }
  }

  /** 启动浏览器 */
  async launch() {
    const { promise, resolve, reject } = Promise.withResolvers<void>()

    clearTimeout(this.launchTimer)

    // 生成内核启动的命令行参数
    const launchArgs = await this.genLaunchCLIArgs()
    console.log('launchArgs', launchArgs)

    // 更新浏览器偏好设置
    await this.updateBrowserPreferences()
    // 写入登录信息
    await this.writeLoginData()
    // 修改浏览器 Local State 文件
    await this.modifyLocalStateFile()
    // 导入书签
    await this.importBookmarks().catch((error) => {
      console.error('导入书签失败', error)
    })

    this.sendSuccessMessage($t('正在启动浏览器'), this.progress)

    this.launchTimer = setTimeout(() => {
      this.sendErrorMessage($t('浏览器启动超时'))
      reject(new Error($t('浏览器启动超时')))
    }, 30.1 * 1000)

    this.makeBrowserActive = async () => {

      const launchOptions: PuppeteerLaunchOptions = {
        args: launchArgs,
        executablePath: this.exePath,
        headless: false,
        ignoreDefaultArgs: true,
        defaultViewport: null,
      }
      console.log('launchOptions', launchOptions)
      let timer

      if (!this.browser) {
        let acc = 0
        timer = setInterval(() => {
          acc += 0.2
          this.sendSuccessMessage($t('正在启动浏览器'), Math.min(this.progress + acc, 98))
        }, 60)

        this.browser = await puppeteer.launch(launchOptions).finally(() => {
          clearInterval(timer)
        })

        this.wsEndpoint = this.browser.wsEndpoint()
        console.log('Browser launched successfully, wsEndpoint:', this.wsEndpoint)
      } else {
        await puppeteer.launch(launchOptions, true).finally(() => {
          clearInterval(timer)
        })
      }

      resolve()
      return this.browser
    }

    // 拉起浏览器
    this.makeBrowserActive().catch((error) => {
      this.sendErrorMessage($t('浏览器启动失败'), error)
      return reject(error)
    }).finally(() => {
      clearTimeout(this.launchTimer)
    })

    return promise
  }

  /** 重新连接浏览器 */
  async reconnectBrowser() {
    if (this.wsEndpoint) {
      try {
        this.browser = await puppeteer.connect({ browserWSEndpoint: this.wsEndpoint })
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

    // 获取内核执行程序路径
    this.exePath = await chromeCoreManager.getCoreExePath(coreVersion, (payload) => {
      if (payload.description && this.currentTask) {
        if (payload.percent) {
          this.progress = this.currentTask.start + ((this.currentTask.end - this.currentTask.start) * (payload.percent / 100))
        }
        this.sendSuccessMessage(payload.description)
      }
    })
      .catch((error) => {
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
      positionSwitch
    } = this.browserItem.winInfo

    const args = [
      ...defaultCLIArgs,
      `--user-data-dir=${this.browserItem.userDataDir}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-backgrounding-occluded-windows',
      // `--custom-devtools-frontend=file://${String.raw`D:\work\devtools-133\devtools-frontend\out\Default\gen\front_end`}`,
    ]

    if (openWorkbench === 1 || (openWorkbench === 2 && store.openWorkbench)) {
      args.push(`http://127.0.0.1:${store.appPort}/dashboard?id=${dirId}`)
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
        console.log('获取扩展失败', error)
        return []
      }).finally(() => {
        clearInterval(timer)
      })
      if (plugins.length) {
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
          // 用户自定义启动参数优先级最低，不能覆盖内置参数
          return !builtInArgKeys.includes(arg.split('=')[0])
        })
      args.push(...userCustomArgs)
    }


    // 如果是全屏，则不设置窗口大小
    if (!positionSwitch) {
      args.push('--start-maximized')
    } else {
      args.push(`--window-size=${openWidth || 1280},${openHeight || 720}`)

      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

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
      } else if (direction === 'br') {
        positions = [xx - winWidth, yy - winHeight]
      } else if (direction === 'bl') {
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
    void (allOpenUrl || []).forEach((item) => {
      if (item && this.browserItem.isValidURL(item)) {
        args.push(item)
      }
    })

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
          } else if (extItem.fixedPlugin === 'pin' && !pinnedExtensions.includes(extID)) {
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
    } catch (error) {
      console.error('更新浏览器偏好设置失败', error)
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
      console.error('代理检测失败', error)
      //  网络不通停止打开
      if (stopOpenNet) {
        return Promise.reject(new Error($t('网络不通停止打开')))
      }

      const message = this.browserItem.winInfo.buyProxyType === 1 ? $t('无法连接至代理，请检查您当前的网络环境并重试。') : $t('代理检测失败')
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
    const fingerprintConfig = genFingerprintConfig(this.browserItem.winInfo, this.proxyInfo)
    console.log('fingerprintConfig fproxy', fingerprintConfig.fproxy)
    try {
      await fileExists(dirname(this.browserItem.fingerprintConfigPath), true)
      const content = encryptFingerprintConfig(JSON.stringify(fingerprintConfig))
      await writeFile(this.browserItem.fingerprintConfigPath, content)
    }
    catch (error) {
      console.error('创建指纹配置文件失败', error)
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
    const { version: remoteVersion } = this.browserItem.winInfo.syncValue as Record<string, any>

    //  如果没有远程版本号，不拉取
    if (!remoteVersion) {
      console.log('没有远程版本号，不拉取')
      return
    }

    const localVersion = await fileExists(this.browserItem.ossCacheVersionPath)
      ? await readFile(this.browserItem.ossCacheVersionPath, 'utf-8')
      : 0

    console.log('localVersion', localVersion)
    console.log('remoteVersion', remoteVersion)

    // 如果本地版本大于等于远程版本，不拉取
    if (Number(localVersion) >= Number(remoteVersion)) {
      console.log('本地版本大于等于远程版本，不拉取')
      return
    }

    const remoteCacheFilePath = `${this.browserItem.winInfo.ossDirPath}${this.browserItem.browserCacheFileName}`
    const localCacheFilePath = join(this.browserItem.ossCacheDir, this.browserItem.browserCacheFileName)

    try {
      await fileExists(dirname(localCacheFilePath), true)
      console.log('开始拉取远程缓存文件', remoteCacheFilePath)
      // 下载远程缓存文件
      await aliOSS.get(remoteCacheFilePath, localCacheFilePath, { workspaceId: this.browserItem.winInfo.workspaceId })
      console.log('下载远程缓存文件成功', localCacheFilePath)
      // 解压缓存文件
      await fileOperations.executeTask('decompress', {
        src: localCacheFilePath,
        dest: this.browserItem.userDataDir,
        filters: this.browserItem.needSyncFiles.map(path => path.slice(1)),
      })
      console.log('解压缓存文件成功', localCacheFilePath)

      console.log('ossCacheVersionPath', this.browserItem.ossCacheVersionPath)
      writeFile(this.browserItem.ossCacheVersionPath, String(remoteVersion))
    }
    catch (error) {
      console.error('同步远程缓存文件失败', error)
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
        console.log('写入 LumiLogin 成功')
      }
      catch (error) {
        this.warningMessages.push($t('登录信息写入失败'))
        console.error('写入 LumiLogin 失败', error)
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
      } else {
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
          enabled_labs_experiments: [...(localState.browser?.enabled_labs_experiments || []), ...experiments]
        }
        if (!isDark) {
          localState.browser.enabled_labs_experiments = localState.browser.enabled_labs_experiments?.filter(item => item !== 'enable-force-dark@1')
        }
      }
      await writeFile(roxyLocalStatePath, JSON.stringify(localState))
    } catch (error) {
      console.error('修改 Local State 文件失败', error)
    }
  }

  /** 根据用户设置，是否要清除浏览器缓存 */
  async clearBrowserCache() {
    const { clearCookie, clearLocalStorage, clearCacheFile } = this.browserItem.winInfo

    if (clearCacheFile) {
      const cacheFilePath = this.browserItem.userDataDir
      try {
        await rm(cacheFilePath, { recursive: true, force: true })
        console.log('cacheFilePath 删除成功', cacheFilePath)
      }
      catch (err) {
        // console.log(`cacheFilePath 删除失败`, err)
        // this.warningMessages.push('缓存文件删除失败')
      }
    }
    else {
      // 当清空缓存先删除cookie文件
      console.log(`是否清空cookie:${clearCookie}`)
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
            console.log('cookieFilePath 删除成功')
          }
          catch (err) {
            this.warningMessages.push($t('cookie文件删除失败'))
            console.log(`cookieFilePath 删除失败`, err)
          }
        }

        console.log(`是否清空 localStorage:${clearLocalStorage}`)
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
              console.log('localStorage_fileUrl 删除成功', localStorageFilePath)
            }
            catch (err) {
              console.log(`localStorage_fileUrl 删失败`, err)
              this.warningMessages.push($t('localStorage文件删除失败'))
            }
          }
        }
      }
    }
  }

  /** 内存检测 */
  private memoryDetection() {
    if (process.platform === 'darwin') {
      return Promise.resolve()
    }

    // 获取系统的总内存和空闲内存，单位是字节
    const { free, total } = process.getSystemMemoryInfo()

    // 计算已使用的内存
    const usedMemory = total - free

    // 计算内存使用率
    const memoryUsageRate = (usedMemory / total) * 100

    // 判断内存使用率是否超过用户设置的阈值
    if (memoryUsageRate > store.memoryLimit) {
      const tips = $t('启动失败，内存使用率超出 {memoryLimit}%', { memoryLimit: store.memoryLimit })
      // 停止打开后续窗口
      return Promise.reject(new Error(tips))
    }
    return Promise.resolve()
  }

  /** 发送成功的消息到渲染进程 */
  sendSuccessMessage(message: string, percent = this.progress) {
    if (this.#lastToken !== store.token) {
      browserManager.openingBrowserMap.delete(this.browserItem.winInfo.dirId!)
      this.taskMap.clear()
    } else {
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
