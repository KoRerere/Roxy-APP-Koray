import { dirname, join } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'
import type { Browser } from 'puppeteer-core'
import { defaultCLIArgs, needSyncLocalFileMap } from '/@/modules/browser/browser-manager/constants'
import { chromeCoreManager } from '/@/modules/browser/chromeCoreManager'
import { appConfig } from '/@/constants'
import type { WindowItemType } from '/@/modules/browser/browser-manager/types'
import { encryptFingerprintConfig, genFingerprintConfig } from '/@/modules/browser/browser-manager/utils'
import { fileExists } from '/@/utils'

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
      throw new Error('没有指定内核版本')
    }
    // 获取内核执行程序路径
    const exePath = await chromeCoreManager.getCoreExePath(coreVersion)
    // 生成内核启动的命令行参数
    const launchArgs = await this.genLaunchCLIArgs()
    console.log('launchArgs', launchArgs)
    // 创建指纹配置文件
    await this.createFingerprintConfigFile()
    // 拉起浏览器
    this.browser = await puppeteer.launch({
      args: launchArgs,
      executablePath: exePath,
      headless: false,
      ignoreDefaultArgs: true,
      defaultViewport: null,
    })
  }

  /** 创建指纹配置文件 */
  async createFingerprintConfigFile() {
    const fingerprintConfig = genFingerprintConfig(this.winInfo)
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
    const { sandboxPermission, startupParam } = this.winInfo

    const args = [
      ...defaultCLIArgs,
      `--user-data-dir=${this.userDataDir}`,
      '--window-position=0,0',
      '--window-size=1000,1000',
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
          return !builtInArgKeys.includes(arg.split('=')[0])
        })
      args.push(...userCustomArgs)
    }

    return args
  }

  async close() {
    if (this.browser) {
      await this.browser.close()
    }
  }
}
