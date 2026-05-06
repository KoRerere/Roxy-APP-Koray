import { app } from 'electron'
import { join } from 'node:path'
import { isPackaged, isProd, isWindows } from '/@/constants/common'
// import { store } from '/@/modules/store'

const sessionDir = app.getPath('sessionData')
const roxyDataDirName = isProd ? '.roxybrowser' : '.roxybrowser-dev'
const roxyDataDir = join(app.getPath('home'), roxyDataDirName)

let store

// 延迟获取 store，避免循环依赖问题
import('/@/modules/store').then((mod) => {
  store = mod.store
})

export const appConfig = {
  /** Electron 会话数据目录（sessionData），用于缓存/临时文件/运行期数据 */
  sessionDir,
  /** Roxy 自定义持久化数据目录（用户 home 下的 .roxybrowser / .roxybrowser-dev；非 Electron 的 appData/userData） */
  roxyDataDir,
  /** 系统语言 */
  lang: app.getLocale(),

  /** chrome 内核缓存目录 */
  chromeBinDir: join(sessionDir, 'chrome-bin'),
  /** firefox 内核缓存目录 */
  firefoxBinDir: join(sessionDir, 'firefox-bin'),
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
  /** agent 脚本文件 */
  get agentBinPath() {
    return join(sessionDir, 'agent-bin', 'roxy-agent.mjs')
  },
  /** openapi mcp 脚本文件 */
  get openapiMcpBinPath() {
    return join(sessionDir, 'agent-bin', 'roxy-openapi.mjs')
  },
  /** playwright mcp 脚本文件 */
  get playwrightMcpBinPath() {
    return join(sessionDir, 'agent-bin', 'roxy-playwright.mjs')
  },
  /** 默认浏览器执行文件所在文件夹 */
  get defaultBrowserBinDir() {
    return join(sessionDir, 'default-browser-bin')
  },
  /** 配置文件 */
  configFile: join(sessionDir, 'config.json'),
  /** 默认浏览器缓存根目录 */
  defaultBrowserCacheRootDir: join(sessionDir, 'browser-cache'),
  /** 预加载文件路径 */
  get preloadFilePath() {
    return isPackaged ? join(import.meta.dirname, './preload/index.mjs') : join(import.meta.dirname, '../../preload/dist/index.mjs')
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
    return appConfig.buildInWebDir
  },
  /** 快捷方式配置文件 */
  get shortcutsConfigFile() {
    return join(this.roxyDataDir, 'shortcuts.json')
  },
  /** roxy 配置文件 */
  get roxyConfigFile() {
    return join(this.roxyDataDir, 'config.json')
  },
} as const

console.debug('appConfig', appConfig)
