import { app } from 'electron'
import { join } from 'node:path'
import { isDev, isPackaged, isWindows } from '/@/constants/common'
import { store } from '/@/modules/store'

const sessionDir = app.getPath('sessionData')

export const appConfig = {
  /** 应用数据根目录 */
  sessionDir,
  /** 系统语言 */
  lang: app.getLocale(),
  /** 内核缓存目录 */
  chromeBinDir: join(sessionDir, 'chrome-bin'),
  /** 浏览器缓存根目录 */
  get browserCacheRootDir() {
    return store.browserCacheRootDir
  },
  /** 浏览器扩展目录 */
  get browserExtensionsDir() {
    return join(this.browserCacheRootDir, 'RoxyExtensions')
  },
  /** 临时文件目录 */
  tempDir: join(sessionDir, 'temp'),
  /** 应用日志目录 */
  logsDir: app.getPath('logs'),
  /** roxynet 执行文件路径 */
  get roxynetBinPath() {
    return join(sessionDir, 'roxynet-bin', isWindows ? 'roxynet.exe' : 'roxynet')
  },
  /** roxysync 执行文件路径 */
  get roxySyncBinPath() {
    return join(sessionDir, 'roxy-sync-bin', isWindows ? 'roxy-sync.exe' : 'roxy-sync')
  },
  /** 默认浏览器执行文件所在文件夹 */
  get defaultBrowserBinDir() {
    return join(sessionDir, 'default-browser-bin')
  },
  /** 默认浏览器执行文件路径 */
  get defaultBrowserBinPath() {
    return join(this.defaultBrowserBinDir, isWindows ? 'roxybrowser.exe' : 'roxybrowser.app/Contents/MacOS/roxybrowser')
  },
  /** 默认浏览器配置文件 */
  defaultBrowserConfig: join(sessionDir, 'default-browser-config.json'),
  /** 配置文件 */
  configFile: join(sessionDir, 'config.json'),
  /** 默认浏览器缓存根目录 */
  defaultBrowserCacheRootDir: join(sessionDir, 'browser-cache'),
  /** 预加载文件路径 */
  get preloadFilePath() {
    return isPackaged ? join(import.meta.dirname, './preload/index.cjs') : join(import.meta.dirname, '../../preload/dist/index.cjs')
  },
  /** asar 解压后的文件路径 */
  unpackedFilePath: join(process.resourcesPath, 'app.asar.unpacked'),
  /** 外部 web 资源目录 */
  externalWebDir: join(sessionDir, 'web'),
  /** APP 内置的 web 资源目录 */
  get buildInWebDir() {
    return join(appConfig.unpackedFilePath, 'dist', 'web')
  },
  /** 查找占用某个句柄的进程， handle.exe（微软工具） */
  get handleExePath() {
    return isPackaged ? join(appConfig.unpackedFilePath, './dist/bin/handle.exe') : join(import.meta.dirname, '../bin', 'handle.exe')
  },
  /** html-template 目录 */
  get htmlTemplateDir() {
    return join(appConfig.currentWebDir, 'html-template')
  },
  /** 当前使用的 web 资源目录 */
  get currentWebDir() {
    if (!isPackaged) {
      return join(import.meta.dirname, '../../web/public')
    }
    return store.isExternalWeb ? appConfig.externalWebDir : appConfig.buildInWebDir
  },
  /** web 资源基础 url */
  get webBaseUrl() {
    return isPackaged ? `http://127.0.0.1:${store.appPort}` : import.meta.env.VITE_DEV_SERVER_URL?.replace(/\/$/, '')
  },
} as const

console.debug('appConfig', appConfig)
