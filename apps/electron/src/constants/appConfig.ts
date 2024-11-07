import { app } from 'electron'
import { join } from 'node:path'
import { store } from '/@/modules/store'
import { isMac } from '/@/utils'

const sessionDir = app.getPath('sessionData')

export const appConfig = {
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
  roxynetBinPath: join(sessionDir, 'roxynet-bin', isMac ? 'roxynet' : 'roxynet.exe'),
  /** 配置文件 */
  configFile: join(sessionDir, 'config.json'),
  /** 默认浏览器缓存根目录 */
  defaultBrowserCacheRootDir: join(sessionDir, 'browser-cache'),
} as const

console.log('appConfig', appConfig)
