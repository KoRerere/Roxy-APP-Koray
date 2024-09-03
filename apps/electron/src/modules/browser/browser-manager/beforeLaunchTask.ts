import { freemem, totalmem } from 'node:os'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { BrowserItem } from './browserItem'
import type { proxyDetection } from '/@/utils'
import { aliOSS, fileExists, getErrorMessage } from '/@/utils'
import { encryptFingerprintConfig, genFingerprintConfig } from './utils'
import AdmZip from 'adm-zip'
import { chromeCoreManager } from '/@/modules/browser'
import type { Browser } from 'puppeteer-core'
import puppeteer from 'puppeteer-core'
import { defaultCLIArgs } from '/@/modules/browser/browser-manager/constants'
import { extensionManager } from '/@/modules/extension'
import { sendErrorMessage, sendSuccessMessage } from '/@/modules/browser/browser-manager/message'

/** 浏览器启动时要做的事情 */
export class BeforeLaunchTask extends BrowserItem {
  browser: Browser | null = null
  /** 代理检测结果 */
  private proxyInfo!: Awaited<ReturnType<typeof proxyDetection>>
  /** 内核执行程序路径 */
  exePath = ''
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
  makeActive!: () => Promise<Browser>

  /** 开始执行任务 */
  async run() {
    this.taskMap.set(this.memoryDetection, '内存检测中')
    this.taskMap.set(this.handleProxyDetection, '代理检测中')
    this.taskMap.set(this.pullRemoteCacheFiles, '拉取远程缓存文件')
    this.taskMap.set(this.createFingerprintConfigFile, '生成指纹配置文件')
    this.taskMap.set(this.launch, '准备启动浏览器')

    this.totalTasks = this.taskMap.size

    // 不通过的任务会抛出异常，中断任务队列
    for (const [task, message] of this.taskMap) {
      try {
        this.sendSuccessMessage(message)
        await task.call(this)
        this.completedTasks++
      }
      catch (error) {
        this.taskMap.clear()
        this.sendErrorMessage(getErrorMessage(error), error)
        return Promise.reject(error)
      }
    }
    // 清空任务队列
    this.taskMap.clear()
    this.sendSuccessMessage('浏览器启动成功')
  }

  /** 启动浏览器 */
  async launch() {
    const { coreVersion } = this.winInfo

    if (!coreVersion) {
      this.sendErrorMessage('没有指定内核版本')
      throw new Error('没有指定内核版本')
    }

    // 获取内核执行程序路径
    this.exePath = await chromeCoreManager.getCoreExePath(coreVersion, (msg: string) => {
      this.sendSuccessMessage(msg, this.progress + 1)
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

    this.makeActive = () => {
      return puppeteer.launch({
        args: launchArgs,
        executablePath: this.exePath,
        headless: false,
        ignoreDefaultArgs: true,
        defaultViewport: null,
      })
    }

    // 拉起浏览器
    this.browser = await this.makeActive().catch((error) => {
      this.sendErrorMessage('浏览器启动失败', error)
      return Promise.reject(error)
    })
  }

  /** 生成内核启动的命令行参数 */
  private async genLaunchCLIArgs(): Promise<string[]> {
    const { dirId, sandboxPermission, usePluginDir, startupParam, systemInfo = {} } = this.winInfo

    const args = [
      ...defaultCLIArgs,
      `--user-data-dir=${this.userDataDir}`,
      '--window-position=0,0',
      '--window-size=1000,1000',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `http://127.0.0.1:8888/dashboard?id=${dirId}`,
    ]

    // 如果用户开启了插件
    if (usePluginDir.length) {
      let acc = 1
      const plugins = await extensionManager.getExtensionByIds(usePluginDir, (msg: string) => {
        this.sendSuccessMessage(msg, this.progress + acc++)
      })
      args.push(`--load-extension=${plugins.join(',')}`)
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
      args.push(`--window-size=${this.winInfo.openWidth || 1280},${this.winInfo.openHeight || 720}`)
      // } else {
      //   exe_strs.push(`--window-size=1280,720`);
      // }
    }

    // 如果是移动端，打开开发者工具
    if ([`Android`, `IOS`].includes(this.winInfo.os)) {
      args.push('--auto-open-devtools-for-tabs')
    }

    // 开启同步标签页后，同步标签页
    (this.winInfo.allOpenUrl || []).forEach((item) => {
      if (this.isValidURL(item)) {
        args.push(item)
      }
    })

    // // console.log(`exe_strs`, exe_strs);
    // if (exe_strs.indexOf(data.platformUrl) == -1) {
    //   exe_strs.push(data.platformUrl);
    // }

    if (!this.winInfo.useGpu) {
      args.push('--disable-gpu')
    };

    return args
  }

  /** 根据代理检测结果决定是否要拉起浏览器 */
  private async handleProxyDetection() {
    const { stopOpenNet, stopOpenIP, stopOpenPosition, lastIp, lastCountry } = this.winInfo

    // 网络不通停止打开 stopOpenNet
    // IP发生变化停止打开 stopOpenIP
    // IP对应国家 / 地区发生改变停止打开 stopOpenPosition
    try {
      // 检测代理信息
      this.proxyInfo = await this.proxyDetection()
    }
    catch (error) {
      console.error('代理检测失败', error)
      //  网络不通停止打开
      if (stopOpenNet) {
        return Promise.reject(new Error('网络不通停止打开'))
      }
    }

    // IP发生变化停止打开
    if (stopOpenIP) {
      if (lastIp && this.proxyInfo.ip !== lastIp) {
        return Promise.reject(new Error('IP发生变化停止打开'))
      }
    }
    // IP对应国家 / 地区发生改变停止打开
    if (stopOpenPosition) {
      if (lastCountry && this.proxyInfo.country_code !== lastCountry) {
        return Promise.reject(new Error('IP对应国家 / 地区发生改变停止打开'))
      }
    }
  }

  /** 创建指纹配置文件 */
  private async createFingerprintConfigFile() {
    // 生成指纹配置
    const fingerprintConfig = genFingerprintConfig(this.winInfo, this.proxyInfo)
    try {
      await fileExists(dirname(this.fingerprintConfigPath), true)
      const content = encryptFingerprintConfig(JSON.stringify(fingerprintConfig))
      await writeFile(this.fingerprintConfigPath, content)
    }
    catch (error) {
      console.error('创建指纹配置文件失败', error)
      return Promise.reject(new Error('创建指纹配置文件失败'))
    }
  }

  /** 拉取远程缓存文件 */
  private async pullRemoteCacheFiles() {
    const { version: remoteVersion } = this.winInfo.syncValue as Record<string, any>

    //  如果没有远程版本号，不拉取
    if (!remoteVersion) {
      console.log('没有远程版本号，不拉取')
      return
    }

    const localVersion = await fileExists(this.ossCacheVersionPath)
      ? await readFile(this.ossCacheVersionPath, 'utf-8')
      : 0

    console.log('localVersion', localVersion)
    console.log('remoteVersion', remoteVersion)

    // 如果本地版本大于等于远程版本，不拉取
    if (Number(localVersion) >= Number(remoteVersion)) {
      console.log('本地版本大于等于远程版本，不拉取')
      return
    }

    const remoteCacheFilePath = `${this.ossRemoteCacheDir}/${this.browserCacheFileName}`
    const localCacheFilePath = join(this.ossCacheDir, this.browserCacheFileName)

    try {
      await fileExists(dirname(localCacheFilePath), true)
      // 下载远程缓存文件
      await aliOSS.get(remoteCacheFilePath, localCacheFilePath)
      const zip = new AdmZip(localCacheFilePath)

      const filters = this.needSyncFiles
      console.log('filters', filters)
      zip.getEntries().forEach((entry) => {
        const target = filters.some(path => entry.entryName.includes(path.slice(1)))
        // console.log('entry.entryName', entry.entryName, target)
        if (!target) {
          return
        }

        if (entry.isDirectory) {
          // console.log('需要解压的文件夹：', entry.entryName);
          zip.extractEntryTo(entry, join(this.userDataDir, entry.entryName), false, true)
        }
        else {
          // console.log('需要解压的文件：', entry.entryName);
          zip.extractEntryTo(entry, dirname(join(this.userDataDir, entry.entryName)), false, true)
        }
      })

      console.log('ossCacheVersionPath', this.ossCacheVersionPath)
      writeFile(this.ossCacheVersionPath, String(remoteVersion))
    }
    catch (error) {
      console.error('拉取远程缓存文件失败', error)
      return Promise.reject(error)
    }
  }

  /** 写入登录信息 */
  private async writeLoginData() {
    const { lumiLogin } = this.winInfo

    if (lumiLogin) {
      try {
        const defaultDir = join(this.userDataDir, 'Default')
        await fileExists(defaultDir, true)
        await writeFile(this.lumiLoginPath, lumiLogin, 'utf8')
        console.log('写入 LumiLogin 成功')
      }
      catch (error) {
        console.error('写入 LumiLogin 失败', error)
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
      const tips = `启动失败，内存使用率超出 ${memoryLimit}%`
      // 停止打开后续窗口
      return Promise.reject(new Error(tips))
    }
    return Promise.resolve()
  }

  /** 发送成功的消息到渲染进程 */
  private sendSuccessMessage(message: string, percent = this.progress) {
    sendSuccessMessage({
      dirId: this.winInfo.dirId!,
      percent,
      message,
    })
  }

  /** 发送错误的消息到渲染进程 */
  private sendErrorMessage(message: string, error?: any) {
    sendErrorMessage(message, this.winInfo.dirId!, error)
  }
}
