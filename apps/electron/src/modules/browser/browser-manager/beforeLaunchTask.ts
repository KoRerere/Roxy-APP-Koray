import type { Browser } from 'puppeteer-core'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { freemem, totalmem } from 'node:os'
import { dirname, join } from 'node:path'
import puppeteer from 'puppeteer-core'
import type { proxyDetection } from '/@/utils'
import { API } from '/@/api'
import { chromeCoreManager } from '/@/modules/browser'
import { defaultCLIArgs } from '/@/modules/browser/browser-manager/constants'
import { sendErrorMessage, sendSuccessMessage } from '/@/modules/browser/browser-manager/message'
import { ExtensionManager } from '/@/modules/extension'
import { fileOperations } from '/@/modules/fileOperations'
import { store } from '/@/modules/store'
import { aliOSS, fileExists, getErrorMessage } from '/@/utils'
import type { BrowserItem } from './browserItem'
import { encryptFingerprintConfig, genFingerprintConfig } from './utils'
import { genExtensionID, getExtensionIDByPath } from '/@/modules/extension/helper'

/** 最后一次发送的消息 */
export interface LastMessage {
  dirId: string
  percent: number
  message: string
  warningMessages: string[]
}

/** 浏览器启动时要做的事情 */
export class BeforeLaunchTask {
  browser: Browser | null = null
  wsEndpoint: string | null = null
  /** 代理检测结果 */
  private proxyInfo = {} as Awaited<ReturnType<typeof proxyDetection>>
  /** 不影响浏览器打开的警告信息 */
  warningMessages: string[] = []
  /** 内核执行程序路径 */
  exePath = ''
  /** 最后一次发送的消息 */
  lastMessage?: LastMessage

  /** 总任务数 */
  private totalTasks = 0
  /** 已完成任务数 */
  private completedTasks = 0
  /** 任务队列 */
  private taskMap = new Map<(() => Promise<void>), string>()
  /** 任务进度 */
  get progress() {
    return ~~((this.completedTasks / this.totalTasks) * 100)
  }

  /** 用于重新拉起浏览器 */
  makeBrowserActive!: () => Promise<Browser>

  constructor(private browserItem: BrowserItem) {
  }

  /** 开始执行任务 */
  async run() {
    this.taskMap.set(this.memoryDetection, $t('内存检测中'))
    this.taskMap.set(this.handleProxyDetection, $t('代理检测中'))
    this.taskMap.set(this.clearBrowserCache, $t('判断是否需要清理浏览器缓存'))
    this.taskMap.set(this.pullRemoteCacheFiles, $t('同步远程缓存文件'))
    this.taskMap.set(this.createFingerprintConfigFile, $t('生成指纹配置文件'))
    this.taskMap.set(this.launch, $t('准备启动浏览器'))

    this.totalTasks = this.taskMap.size

    // 不通过的任务会抛出异常，中断任务队列
    for (const [task, message] of this.taskMap) {
      try {
        this.sendSuccessMessage(message)
        await task.call(this)
        this.completedTasks++
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
    this.sendSuccessMessage($t('浏览器启动成功'))
    // 同步窗口状态
    API.window.userMdfWindowSyncV2Create([{
      id: this.browserItem.winInfo.id,
      openStatus: true,
    }]).then(() => {
      console.log('启动前同步窗口状态成功')
    })
    if (this.proxyInfo?.ip) {
      API.window.userMdfWindowInfoSingleV2Create({
        id: this.browserItem.winInfo.id!,
        lastIp: this.proxyInfo.ip,
        lastCountry: this.proxyInfo.country_code,
      }).then(() => {
        console.log('同步ip信息成功')
      })
    }
  }

  /** 启动浏览器 */
  async launch() {
    const { coreVersion } = this.browserItem.winInfo

    if (!coreVersion) {
      this.sendErrorMessage($t('没有指定内核版本'))
      throw new Error($t('没有指定内核版本'))
    }

    let initCount = 1
    // 获取内核执行程序路径
    this.exePath = await chromeCoreManager.getCoreExePath(coreVersion, (msg: string) => {
      this.sendSuccessMessage(msg, this.progress + initCount++)
    })
      .catch((error) => {
        this.sendErrorMessage(error.message, error)
        return Promise.reject(error)
      })

    // 生成内核启动的命令行参数
    const launchArgs = await this.genLaunchCLIArgs()
    console.log('launchArgs', launchArgs)

    // 写入登录信息
    await this.writeLoginData()

    this.sendSuccessMessage($t('正在启动浏览器'), this.progress + initCount++)

    this.makeBrowserActive = async () => {
      if (this.browser) {
        await this.reconnectBrowser()
      }

      this.browser = await puppeteer.launch({
        args: launchArgs,
        executablePath: this.exePath,
        headless: false,
        ignoreDefaultArgs: true,
        defaultViewport: null,
      })

      this.wsEndpoint = this.browser.wsEndpoint()
      console.log('Browser launched successfully, wsEndpoint:', this.wsEndpoint)
      return this.browser
    }

    // 拉起浏览器
    this.browser = await this.makeBrowserActive().catch((error) => {
      this.sendErrorMessage($t('浏览器启动失败'), error)
      return Promise.reject(error)
    })
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

  /** 生成内核启动的命令行参数 */
  private async genLaunchCLIArgs(): Promise<string[]> {
    const {
      dirId,
      sandboxPermission,
      usePluginList,
      startupParam,
      systemInfo = {},
      openWidth,
      openHeight,
      os,
      allOpenUrl,
      useGpu,
      workspaceId
    } = this.browserItem.winInfo

    const args = [
      ...defaultCLIArgs,
      `--user-data-dir=${this.browserItem.userDataDir}`,
      '--window-position=0,0',
      '--window-size=1000,1000',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `http://localhost:${store.appPort}/dashboard?id=${dirId}`,
    ]

    // 如果用户开启了插件
    if (usePluginList.length) {
      let acc = 1
      const extensionManager = new ExtensionManager({ workspaceId })
      const plugins = await extensionManager.getTargetExtensions(usePluginList, (msg: string) => {
        this.sendSuccessMessage(msg, this.progress + acc++)
      }).catch((error) => {
        this.warningMessages.push($t('获取扩展失败'))
        console.log('获取扩展失败', error)
        return []
      })
      if (plugins.length) {
        await this.updateBrowserPreferences()
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
      const userCustomArgs = startupParam.split(',')
        .map((item: string) => item.trim())
        .filter((arg: string) => {
          // 用户自定义启动参数优先级最低，不能覆盖内置参数
          return !builtInArgKeys.includes(arg.split('=')[0])
        })
      args.push(...userCustomArgs)
    }

    const { winOpenType, OpenPositonX, OpenPositonY } = systemInfo
    // 浏览器打开位置设置
    if (winOpenType === 'pos') {
      args.push(`--window-position=${OpenPositonX},${OpenPositonY}`)
    }
    else {
      args.push(`--window-position=0,0`)
      // exe_strs.push(`--window-position=${parseInt(Math.random() * 1000)},${parseInt(Math.random() * 1000)}`)
    }

    // 设置浏览器窗口大小
    if (winOpenType === 'max') {
      // 最大化
      args.push(`--start-maximized`)
    }
    else if (winOpenType === 'min') {
      // 最小化
      args.push(`--start-minimized`)
    }
    else {
      // 默认尺寸
      // if (data.resolutionType === true) {
      args.push(`--window-size=${openWidth || 1280},${openHeight || 720}`)
      // } else {
      //   exe_strs.push(`--window-size=1280,720`);
      // }
    }

    // 如果是移动端，打开开发者工具
    if ([`Android`, `IOS`].includes(os)) {
      args.push('--auto-open-devtools-for-tabs')
    }

    // 开启同步标签页后，同步标签页
    (allOpenUrl || []).forEach((item) => {
      if (item && this.browserItem.isValidURL(item)) {
        args.push(item)
      }
    })

    // // console.log(`exe_strs`, exe_strs);
    // if (exe_strs.indexOf(data.platformUrl) == -1) {
    //   exe_strs.push(data.platformUrl);
    // }

    if (!useGpu) {
      args.push('--disable-gpu')
    };

    return args
  }

  /** 更新浏览器偏好设置 */
  async updateBrowserPreferences() {
    const { preferencesPath, winInfo } = this.browserItem
    const { usePluginList, workspaceId } = winInfo

    if (!usePluginList.length) {
      return
    }

    console.log('usePluginList', usePluginList)

    try {
      const isExist = await fileExists(preferencesPath)

      if (!isExist) {
        await writeFile(preferencesPath, JSON.stringify({ extensions: { pinned_extensions: [] } }))
      }

      const preferences = JSON.parse(await readFile(preferencesPath, 'utf-8'))
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
      this.warningMessages.push($t('代理检测失败'))
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
      await aliOSS.get(remoteCacheFilePath, localCacheFilePath)
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

  /** 内存检测 */
  private memoryDetection() {
    if (process.platform === 'darwin') {
      return Promise.resolve()
    }

    // 获取系统的总内存和空闲内存，单位是字节
    const totalMemory = totalmem()
    const freeMemory = freemem()
    const memoryLimit = 95

    // 计算已使用的内存
    const usedMemory = totalMemory - freeMemory

    // 计算内存使用率
    const memoryUsageRate = (usedMemory / totalMemory) * 100

    // 判断内存使用率是否超过用户设置的阈值
    if (memoryUsageRate > memoryLimit) {
      const tips = $t('启动失败，内存使用率超出 {memoryLimit}%', { memoryLimit })
      // 停止打开后续窗口
      return Promise.reject(new Error(tips))
    }
    return Promise.resolve()
  }

  /** 发送成功的消息到渲染进程 */
  sendSuccessMessage(message: string, percent = this.progress) {
    this.lastMessage = {
      dirId: this.browserItem.winInfo.dirId!,
      percent,
      message,
      warningMessages: this.warningMessages,
    }
    sendSuccessMessage(this.lastMessage)
  }

  /** 发送错误的消息到渲染进程 */
  private sendErrorMessage(message: string, error?: any) {
    sendErrorMessage(message, this.browserItem.winInfo.dirId!, error)
  }
}
