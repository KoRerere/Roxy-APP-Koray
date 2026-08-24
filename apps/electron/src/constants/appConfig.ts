import { app } from 'electron'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { isPackaged, isProd, isWindows } from '/@/constants/common'

const require = createRequire(import.meta.url)
const sessionDir = app.getPath('sessionData')
const roxyDataDirName = isProd ? '.roxybrowser' : '.roxybrowser-dev'
const roxyDataDir = join(app.getPath('home'), roxyDataDirName)

export const appConfig = {
  /** Electron 会话数据目录（sessionData），用于缓存/临时文件/运行期数据 */
  sessionDir,
  /** Roxy 自定义持久化数据目录（用户 home 下的 .roxybrowser / .roxybrowser-dev；非 Electron 的 appData/userData） */
  roxyDataDir,
  /** 系统语言 */
  lang: app.getLocale(),
  /** APP 静态资源路径（打包后 resources/ 部分文件被 asarUnpack 解包，路径需指向 app.asar.unpacked） */
  staticResourceDir: join(import.meta.dirname, '..', 'resources').replace('app.asar', 'app.asar.unpacked'),
  /** chrome 内核缓存目录 */
  chromeBinDir: join(sessionDir, 'chrome-bin'),
  /** firefox 内核缓存目录 */
  firefoxBinDir: join(sessionDir, 'firefox-bin'),
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
  /**
   * roxynet 内置 seed 目录（只读）
   *
   * 打包时按安装包 arch 通过 extraResources 内置到 resources/roxynet-seed，
   * 内含二进制 + version + sha512，用于启动自愈与损坏回滚，不联网。
   * 非打包(dev)环境 resources 下不存在 seed，ensureActiveFromSeed 会自动回退到后台下载。
   */
  get roxynetSeedDir() {
    return join(process.resourcesPath, 'roxynet-seed')
  },
  /** roxysync 内置 seed 目录（只读，仅 Windows 内置） */
  get roxySyncSeedDir() {
    return join(process.resourcesPath, 'roxy-sync-seed')
  },
  /** 内置 ripgrep 执行文件路径（供 Agent 子进程 PATH 注入；无热更新） */
  get rgBinPath() {
    if (isPackaged) {
      return join(process.resourcesPath, 'rg', isWindows ? 'rg.exe' : 'rg')
    }
    return require('@vscode/ripgrep').rgPath as string
  },
  /** agent 脚本文件 */
  get agentBinPath() {
    return join(sessionDir, 'agent-bin', 'roxy-agent.mjs')
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
  /** Tauri 默认浏览器 launcher 日志（与 apps/tauri paths.rs 保持一致） */
  get launcherLogFile() {
    return join(this.roxyDataDir, 'logs', 'launcher.log')
  },
} as const

console.debug('appConfig', appConfig)
