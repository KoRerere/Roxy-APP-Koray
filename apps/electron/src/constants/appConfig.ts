import { app } from 'electron'
import { join } from 'node:path'
import { store } from '/@/utils/'

const sessionDir = app.getPath('sessionData')

let browserCacheRootDir = store.get('browserCacheRootDir', join(sessionDir, 'browser-cache'))

export const appConfig = {
  /** 系统语言 */
  lang: app.getLocale(),
  /** 内核缓存目录 */
  chromeBinDir: join(sessionDir, 'chrome-bin'),
  /** 浏览器缓存根目录 */
  get browserCacheRootDir() {
    return browserCacheRootDir
  },
  set browserCacheRootDir(dir: string) {
    browserCacheRootDir = dir
    store.set('browserCacheRootDir', dir)
  },
  /** 临时文件目录 */
  tempDir: join(sessionDir, 'temp'),
  /** 应用日志目录 */
  logsDir: app.getPath('logs'),
} as const

console.log('appConfig', appConfig)
