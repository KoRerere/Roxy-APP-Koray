import type { BrowserItem } from './browserItem'
import type { UserGetUserConfigListData } from '@roxy/backend-api'
import type { ProxyDetectionResult } from '~/utils'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { API } from '~/api'
import { OPEN_URLS_FILE } from '~/constants/common'
import { createAliOSSStore, fileExists, unzipToDirectory } from '~/utils'
import { ExtensionManager, getExtensionIDByPath } from '../extension'
import { encryptFingerprintConfig, genFingerprintConfig } from '../utils'
import { importBookmarks } from '../utils/importBookmarks'
import { defaultCLIArgs } from './constants'

const SCREEN_SIZE_PATTERN = /^(\d+)x(\d+)(?:@\d+)?$/i

export interface BeforeLaunchResult {
  proxyInfo: ProxyDetectionResult
  /** 宿主机上的扩展目录（供容器挂载） */
  extensionHostDir: string | null
  /** 完整的浏览器启动参数列表（含 --load-extension 等），供 NEKO_DESKTOP_COMMAND 使用 */
  browserLaunchArgs: string[]
}

interface BeforeLaunchTaskOptions {
  /** 全局用户配置（替代 Electron 的 store） */
  globalConfig: UserGetUserConfigListData['data']
  /** 扩展存储根目录 */
  extensionBaseDir: string
  /** 浏览器主题色 */
  browserColorScheme: string
  /** 容器内浏览器用户数据路径 */
  nekoDataDir: string
  /** 容器桌面分辨率（例如 1920x1080@30） */
  nekoScreen: string
}

interface OSSRequestError {
  code?: string
  status?: number
  params?: {
    object?: string
  }
}

/** 浏览器启动前文件预处理任务 */
export class BeforeLaunchTask {
  proxyInfo = {} as ProxyDetectionResult
  private warningMessages: string[] = []
  private options: BeforeLaunchTaskOptions

  constructor(
    private browserItem: BrowserItem,
    options: BeforeLaunchTaskOptions,
  ) {
    this.options = options
  }

  /** 执行所有启动前任务，返回扩展信息 */
  async run(): Promise<BeforeLaunchResult> {
    const tasks: { name: string, handler: () => Promise<void> }[] = [
      { name: '代理 IP 检测', handler: () => this.handleProxyDetection() },
      { name: '清理浏览器缓存', handler: () => this.clearBrowserCache() },
      { name: '同步远程缓存文件', handler: () => this.pullRemoteCacheFiles() },
      { name: '生成指纹配置文件', handler: () => this.createFingerprintConfigFile() },
      { name: '更新浏览器偏好设置', handler: () => this.updateBrowserPreferences() },
      { name: '写入登录信息', handler: () => this.writeLoginData() },
      { name: '修改 Local State', handler: () => this.modifyLocalStateFile() },
      { name: '导入书签', handler: () => this.importBookmarks() },
    ]

    for (const task of tasks) {
      try {
        console.log(`[启动前任务] 开始执行：${task.name}`)
        await task.handler()
      }
      catch (error: any) {
        console.error(`[启动前任务] ${task.name} 失败：`, error.message)
        throw error
      }
    }

    const { extensionPaths, extensionHostDir } = await this.downloadExtensions()

    // 生成完整的浏览器启动参数（含扩展）
    const browserLaunchArgs = await this.genBrowserLaunchArgs(extensionPaths)

    if (this.proxyInfo?.ip) {
      API.window.userMdfWindowInfoSingleV2Create({
        ...this.browserItem.winInfo,
        id: this.browserItem.winInfo.id!,
        lastIp: this.proxyInfo.ip,
        lastCountry: this.proxyInfo.country_code,
      } as any, { headers: this.browserItem.requestHeaders }).catch(err =>
        console.warn('[启动前任务] IP 同步失败：', err.message),
      )
    }

    if (this.warningMessages.length) {
      console.warn('[启动前任务] 警告：', this.warningMessages)
    }

    return { proxyInfo: this.proxyInfo, extensionHostDir, browserLaunchArgs }
  }

  /** 下载扩展并返回路径信息 */
  private async downloadExtensions(): Promise<{ extensionPaths: string[], extensionHostDir: string | null }> {
    const { usePluginList, workspaceId } = this.browserItem.winInfo
    if (!usePluginList?.length) {
      return { extensionPaths: [], extensionHostDir: null }
    }

    console.log(`[启动前任务] 下载扩展 (${usePluginList.length} 个)...`)
    const extensionManager = new ExtensionManager({
      workspaceId: workspaceId!,
      token: this.browserItem.requestHeaders.token,
      extensionBaseDir: this.options.extensionBaseDir,
    })

    try {
      const hostPaths = await extensionManager.getTargetExtensions(usePluginList)

      // 清理 _metadata/generated_indexed_rulesets 以避免规则集缓存问题
      await Promise.allSettled(hostPaths.map(async (plugin) => {
        const localPath = join(plugin, '_metadata', 'generated_indexed_rulesets')
        await rm(localPath, { recursive: true, force: true })
      }))

      // 将宿主机路径映射为容器内路径
      const extensionHostDir = extensionManager.extensionDir
      const containerExtPaths = hostPaths.map((hostPath) => {
        const relativePath = hostPath.replace(extensionHostDir, '')
        return `/extensions${relativePath}`
      })

      return { extensionPaths: containerExtPaths, extensionHostDir }
    }
    catch (error: any) {
      this.warningMessages.push($t('获取扩展失败'))
      console.error('[启动前任务] 扩展下载失败：', error.message)
      return { extensionPaths: [], extensionHostDir: null }
    }
  }

  /**
   * 生成浏览器启动的命令行参数（对齐 Electron genLaunchCLIArgs，去掉桌面专属逻辑）
   * @param extensionPaths 容器内扩展路径列表
   */
  private async genBrowserLaunchArgs(extensionPaths: string[]): Promise<string[]> {
    const { startupParam, os, useGpu, allOpenUrl = [] } = this.browserItem.winInfo
    const windowSize = this.parseWindowSize(this.options.nekoScreen)
    const protectedArgs = new Set([
      '--user-data-dir',
      '--start-fullscreen',
      '--start-maximized',
      '--window-size',
      '--window-position',
    ])

    const args = [
      ...defaultCLIArgs,
      `--user-data-dir=${this.options.nekoDataDir}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu-sandbox',
      '--password-store=basic',
      '--disable-backgrounding-occluded-windows',
      '--disable-infobars',
      '--start-maximized',
      `--window-size=${windowSize}`,
      '--window-position=0,0',
    ]

    if (extensionPaths.length) {
      args.push(`--load-extension=${extensionPaths.join(',')}`)
    }

    // 用户自定义启动参数（分号分隔，--user-data-dir 不可覆盖）
    if (startupParam?.trim()) {
      const userCustomArgs = startupParam.split(';')
        .map((s: string) => s.trim())
        .filter((arg: string) => {
          const key = arg.split('=')[0]
          // 受保护参数禁止外部覆盖，保持容器启动行为可控
          if (protectedArgs.has(key))
            return false
          const existingIndex = args.findIndex(a => a.split('=')[0] === key)
          if (existingIndex !== -1)
            args.splice(existingIndex, 1)
          return true
        })
      args.push(...userCustomArgs)
    }
    // 强制允许容器外连接 DevTools，避免默认只监听 127.0.0.1 导致网关连接被拒绝
    const remoteDebuggingAddressKey = '--remote-debugging-address'
    const existingRemoteDebuggingAddressIndex = args.findIndex(arg => arg.split('=')[0] === remoteDebuggingAddressKey)
    if (existingRemoteDebuggingAddressIndex !== -1) {
      args.splice(existingRemoteDebuggingAddressIndex, 1)
    }
    args.push('--remote-debugging-address=0.0.0.0')
    const existingStartMaximizedIndex = args.findIndex(arg => arg.split('=')[0] === '--start-maximized')
    if (existingStartMaximizedIndex !== -1) {
      args.splice(existingStartMaximizedIndex, 1)
    }
    const existingWindowSizeIndex = args.findIndex(arg => arg.split('=')[0] === '--window-size')
    if (existingWindowSizeIndex !== -1) {
      args.splice(existingWindowSizeIndex, 1)
    }
    const existingWindowPositionIndex = args.findIndex(arg => arg.split('=')[0] === '--window-position')
    if (existingWindowPositionIndex !== -1) {
      args.splice(existingWindowPositionIndex, 1)
    }
    const existingStartFullscreenIndex = args.findIndex(arg => arg.split('=')[0] === '--start-fullscreen')
    if (existingStartFullscreenIndex !== -1) {
      args.splice(existingStartFullscreenIndex, 1)
    }
    const existingWindowSizeIndices = args
      .map((arg, index) => ({ arg, index }))
      .filter(({ arg }) => arg.split('=')[0] === '--window-size')
      .map(({ index }) => index)
      .reverse()
    for (const index of existingWindowSizeIndices) {
      args.splice(index, 1)
    }
    args.push('--start-maximized')
    args.push(`--window-size=${windowSize}`)
    args.push('--window-position=0,0')

    if (['Android', 'IOS'].includes(os)) {
      args.push('--auto-open-devtools-for-tabs')
    }

    if (!useGpu) {
      args.push('--disable-gpu')
    }

    const defaultOpenUrls = await readFile(OPEN_URLS_FILE, 'utf8').then(content => JSON.parse(content) as string[]).catch(() => [])

    defaultOpenUrls.forEach((url) => {
      const hostName = new URL(url).hostname
      if (!allOpenUrl.includes(hostName)) {
        args.push(url)
      }
    })

    return args.filter(a => a.trim() !== '')
  }

  /** 将 NEKO_DESKTOP_SCREEN 转为 Chromium 的 --window-size 参数值 */
  private parseWindowSize(screen: string): string {
    const match = screen.match(SCREEN_SIZE_PATTERN)
    if (!match) {
      return '1920,1080'
    }
    return `${match[1]},${match[2]}`
  }

  /** 代理检测 */
  private async handleProxyDetection() {
    const { stopOpenNet, stopOpenIP, stopOpenPosition, lastIp, lastCountry } = this.browserItem.winInfo

    try {
      this.proxyInfo = await this.browserItem.proxyDetection()
    }
    catch (error) {
      console.error('代理检测失败：', error)
      if (stopOpenNet) {
        throw new Error($t('网络不通停止打开'))
      }
      this.warningMessages.push($t('代理 IP 检测失败'))
      return
    }

    if (stopOpenIP && lastIp && this.proxyInfo.ip !== lastIp) {
      throw new Error($t('IP发生变化停止打开'))
    }
    if (stopOpenPosition && lastCountry && this.proxyInfo.country_code !== lastCountry) {
      throw new Error($t('IP对应国家 / 地区发生改变停止打开'))
    }
  }

  /** 生成指纹配置文件 */
  private async createFingerprintConfigFile() {
    const fingerprintConfig = await genFingerprintConfig({
      winInfo: this.browserItem.winInfo,
      proxyInfo: this.proxyInfo,
      globalConfig: this.options.globalConfig,
    })
    console.log('[启动前任务] fproxy 配置：', fingerprintConfig.fproxy)

    try {
      const dirPath = dirname(this.browserItem.fingerprintConfigPath)
      const created = await fileExists(dirPath, true)
      if (!created) {
        throw new Error(`无法创建指纹目录: ${dirPath}`)
      }
      const content = encryptFingerprintConfig(JSON.stringify(fingerprintConfig))
      await writeFile(this.browserItem.fingerprintConfigPath, content)
    }
    catch (error) {
      console.error('创建指纹配置失败：', error)
      throw new Error($t('创建指纹配置文件失败'))
    }
  }

  /** 更新浏览器偏好设置 */
  private async updateBrowserPreferences() {
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
        const pinnedExtensions = preferences.extensions?.pinned_extensions || []
        const extensionManager = new ExtensionManager({
          workspaceId: workspaceId!,
          token: this.browserItem.requestHeaders.token,
          extensionBaseDir: this.options.extensionBaseDir,
        })

        for (const extItem of usePluginList) {
          const extID = await getExtensionIDByPath(
            join(extensionManager.extensionDir, extItem.pluginDir),
          ).catch(() => '')
          if (!extID)
            continue

          if (extItem.fixedPlugin === 'unpin') {
            const index = pinnedExtensions.indexOf(extID)
            if (index !== -1)
              pinnedExtensions.splice(index, 1)
          }
          else if (extItem.fixedPlugin === 'pin' && !pinnedExtensions.includes(extID)) {
            pinnedExtensions.push(extID)
          }
        }
        preferences.extensions ??= {}
        preferences.extensions.pinned_extensions = pinnedExtensions
      }

      preferences.browser ??= {}
      preferences.browser.theme ??= {}
      const colorSchemeMap: Record<string, number> = { system: 0, light: 1, dark: 2 }
      preferences.browser.theme.color_scheme2 = colorSchemeMap[this.options.browserColorScheme] ?? 0
      preferences.browser.theme.color_scheme = preferences.browser.theme.color_scheme2

      await writeFile(preferencesPath, JSON.stringify(preferences))
    }
    catch (error) {
      console.error('更新浏览器偏好设置失败：', error)
    }
  }

  /** 写入登录信息 */
  private async writeLoginData() {
    const { lumiLogin } = this.browserItem.winInfo
    if (!lumiLogin)
      return

    try {
      const defaultDir = join(this.browserItem.userDataDir, 'Default')
      await fileExists(defaultDir, true)
      await writeFile(this.browserItem.lumiLoginPath, lumiLogin, 'utf8')
    }
    catch (error) {
      this.warningMessages.push($t('登录信息写入失败'))
      console.error('写入 LumiLogin 失败：', error)
    }
  }

  /** 修改浏览器 Local State 文件 */
  private async modifyLocalStateFile() {
    const { roxyLocalStatePath } = this.browserItem
    let localState: Record<string, any> = {}

    try {
      const isExist = await fileExists(roxyLocalStatePath)
      if (isExist) {
        localState = JSON.parse(await readFile(roxyLocalStatePath, 'utf-8'))
      }
      else {
        await fileExists(dirname(roxyLocalStatePath), true)
      }

      localState.background_mode = { enabled: false }

      if (Number(this.browserItem.winInfo.coreVersion) < 136) {
        const isDark = this.options.browserColorScheme === 'dark'
        const experiments = isDark ? ['enable-force-dark@1'] : []
        localState.browser = {
          ...localState.browser,
          enabled_labs_experiments: [
            ...(localState.browser?.enabled_labs_experiments || []).filter((item: string) => item !== 'enable-force-dark@1'),
            ...experiments,
          ],
        }
      }

      await writeFile(roxyLocalStatePath, JSON.stringify(localState))
    }
    catch (error) {
      console.error('修改 Local State 失败：', error)
    }
  }

  /** 导入书签 */
  private async importBookmarks() {
    const { openBookmarks, bookmarks } = this.browserItem.winInfo
    if (!openBookmarks || !bookmarks)
      return

    try {
      const bookmarkPath = join(this.browserItem.userDataDir, 'Default', 'Bookmarks')
      await importBookmarks({
        bookmarks,
        bookmarkPath,
        preferencesPath: this.browserItem.preferencesPath,
      })
    }
    catch (error) {
      console.error('导入书签失败：', error)
    }
  }

  /** 清理浏览器缓存 */
  private async clearBrowserCache() {
    const { clearCookie, clearLocalStorage, clearCacheFile } = this.browserItem.winInfo

    if (clearCacheFile) {
      await rm(this.browserItem.userDataDir, { recursive: true, force: true }).catch(() => {})
      return
    }

    if (clearCookie) {
      const cookieFilePath = join(this.browserItem.userDataDir, 'Default', 'Network', 'Cookies')
      if (await fileExists(cookieFilePath)) {
        await rm(cookieFilePath, { recursive: true }).catch((err) => {
          this.warningMessages.push($t('cookie文件删除失败'))
          console.error('删除 Cookie 文件失败：', err)
        })
      }
    }

    if (clearLocalStorage) {
      const localStoragePath = join(this.browserItem.userDataDir, 'Default', 'Local Storage')
      if (await fileExists(localStoragePath)) {
        await rm(localStoragePath, { recursive: true }).catch((err) => {
          this.warningMessages.push($t('localStorage文件删除失败'))
          console.error('删除 localStorage 失败：', err)
        })
      }
    }
  }

  /** 拉取远程 OSS 缓存文件 */
  private async pullRemoteCacheFiles() {
    const syncValue = this.browserItem.winInfo.syncValue as Record<string, any> | undefined
    if (!syncValue)
      return

    const { version: remoteVersion, fileCount } = syncValue
    if (!remoteVersion || fileCount === 0)
      return

    const localVersion = await fileExists(this.browserItem.ossCacheVersionPath)
      ? await readFile(this.browserItem.ossCacheVersionPath, 'utf-8')
      : '0'

    if (Number(localVersion) >= Number(remoteVersion)) {
      console.log('本地版本大于等于远端版本，跳过拉取')
      return
    }

    const remoteCacheFilePath = `${this.browserItem.winInfo.ossDirPath}${this.browserItem.browserCacheFileName}`
    const localCacheFilePath = join(this.browserItem.ossCacheDir, this.browserItem.browserCacheFileName)

    try {
      await fileExists(dirname(localCacheFilePath), true)
      const aliOSS = await createAliOSSStore(this.browserItem.requestHeaders)
      await aliOSS.get(remoteCacheFilePath, localCacheFilePath)
      console.log('远端缓存已下载：', localCacheFilePath)

      const filters = this.browserItem.needSyncFiles.map(p => p.slice(1))
      await unzipToDirectory(localCacheFilePath, this.browserItem.userDataDir, {
        filter: entryName => filters.some(f => entryName.startsWith(f)),
      })
      console.log('缓存文件解压完成')
      await writeFile(this.browserItem.ossCacheVersionPath, String(remoteVersion))
    }
    catch (error) {
      // ali-oss 在下载失败时可能已创建半成品文件，避免后续误解压旧文件。
      await rm(localCacheFilePath, { force: true }).catch(() => {})

      if (this.isRemoteCacheMissingError(error)) {
        console.warn('[启动前任务] 未找到远端缓存文件，跳过同步：', remoteCacheFilePath)
        return
      }

      console.error('同步远端缓存失败：', error)
      this.warningMessages.push($t('同步远程缓存文件失败'))
    }
  }

  /** 远端缓存不存在时视为首次启动或元数据滞后，不阻断浏览器启动。 */
  private isRemoteCacheMissingError(error: unknown): boolean {
    const ossError = error as OSSRequestError | undefined
    return ossError?.code === 'NoSuchKey' || ossError?.status === 404
  }
}
