import { dirname, join } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'
import type { Browser } from 'puppeteer-core'
import { defaultCLIArgs, needSyncLocalFileMap } from '/@/modules/browser/browser-manager/constants'
import { chromeCoreManager } from '/@/modules/browser/chromeCoreManager'
import { appConfig } from '/@/constants'
import type { WindowItemType } from '/@/modules/browser/browser-manager/types'
import { encryptFingerprintConfig, genFingerprintConfig } from '/@/modules/browser/browser-manager/utils'
import { fileExists, proxyDetection } from '/@/utils'
import { errorDataWrapper, ipcMain, successDataWrapper } from '/@/modules/ipc'
import type { BrowserProcessMessage } from '@roxy/electron-preload'

export class BrowserItem {
  private browser: Browser | null = null
  /** 当前浏览器配置信息 */
  winInfo: WindowItemType
  /** 浏览器用户数据目录 */
  userDataDir: string
  /** 指纹配置文件路径 */
  get fingerprintConfigPath() {
    return join(this.userDataDir, 'lumi.conf')
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
    const { coreVersion } = this.winInfo

    if (!coreVersion) {
      this.sendErrorMessage('没有指定内核版本')
      throw new Error('没有指定内核版本')
    }

    this.sendSuccessMessage({
      percent: 0,
      message: '初始化参数中',
    })
    // 获取内核执行程序路径
    const exePath = await chromeCoreManager.getCoreExePath(coreVersion)
      .catch((error) => {
        this.sendErrorMessage(error.message, error)
        return Promise.reject(error)
      })
    // 生成内核启动的命令行参数
    const launchArgs = await this.genLaunchCLIArgs()
    console.log('launchArgs', launchArgs)

    this.sendSuccessMessage({
      percent: 50,
      message: '正在生成指纹配置文件',
    })
    // 创建指纹配置文件
    await this.createFingerprintConfigFile().catch((error) => {
      this.sendErrorMessage('生成指纹配置文件失败', error)
      return Promise.reject(error)
    })
    // 拉起浏览器
    this.browser = await puppeteer.launch({
      args: launchArgs,
      executablePath: exePath,
      headless: false,
      ignoreDefaultArgs: true,
      defaultViewport: null,
    }).catch((error) => {
      this.sendErrorMessage('浏览器启动失败', error)
      return Promise.reject(error)
    })

    this.sendSuccessMessage({
      percent: 100,
      message: '浏览器启动成功',
    })
  }

  /** 发送成功的消息到渲染进程 */
  sendSuccessMessage(data: Omit<BrowserProcessMessage, 'dirId'>) {
    ipcMain.send('browser:process-message', successDataWrapper({
      dirId: this.winInfo.dirId!,
      ...data,
    }))
  }

  /** 发送错误的消息到渲染进程 */
  sendErrorMessage(message: string, error?: any) {
    ipcMain.send('browser:process-message', errorDataWrapper(message, this.winInfo.dirId, error))
  }

  /** 创建指纹配置文件 */
  async createFingerprintConfigFile() {
    // 检测代理信息
    const proxyInfo = await proxyDetection(this.winInfo)
    console.log('proxyInfo', proxyInfo)
    // 生成指纹配置
    const fingerprintConfig = genFingerprintConfig(this.winInfo, proxyInfo)
    try {
      const dirExist = await fileExists(dirname(this.fingerprintConfigPath))
      if (!dirExist) {
        await mkdir(dirname(this.fingerprintConfigPath), { recursive: true })
      }
      const content = encryptFingerprintConfig(JSON.stringify(fingerprintConfig))
      await writeFile(this.fingerprintConfigPath, content)
    }
    catch (error) {
      return Promise.reject(error)
    }
  }

  /** 生成内核启动的命令行参数 */
  async genLaunchCLIArgs(): Promise<string[]> {
    const { sandboxPermission, startupParam, systemInfo = {} } = this.winInfo

    const args = [
      ...defaultCLIArgs,
      `--user-data-dir=${this.userDataDir}`,
      '--window-position=0,0',
      '--window-size=1000,1000',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      'http://127.0.0.1:7777/console?id=08767b01eca86fe7713be1ed21736d3b',
    ]

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
      if (this.filterTab(item)) {
        args.push(item)
      }
    })

    // // $LOG(`exe_strs`, exe_strs);
    // if (exe_strs.indexOf(data.platformUrl) == -1) {
    //   exe_strs.push(data.platformUrl);
    // }

    if (!this.winInfo.useGpu) {
      args.push('--disable-gpu')
    };

    return args
  }

  /** 过滤标签页 */
  filterTab(url: string) {
    const invalidUrls = ['chrome://newtab/', 'chrome-extension://', 'about:blank']
    if (invalidUrls.includes(url)) {
      return false
    }
    return true
  }

  async close() {
    if (this.browser) {
      await this.browser.close()
    }
  }
}
