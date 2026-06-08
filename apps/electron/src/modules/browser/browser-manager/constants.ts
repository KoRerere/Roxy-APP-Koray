import { appConfig } from '/@/constants'
import { isMac } from '/@/constants/common'
import { CoreType } from '/@/modules/browser/browser-manager/adapter'
import { store } from '/@/modules/store'

/** 默认的 Chrome 浏览器启动参数 */
export const defaultCLIArgs = [
  '--disable-background-mode',
  '--disable-popup-blocking',
  '--no-first-run',
  '--no-default-browser-check',
  '--remote-debugging-port=0',
  isMac ? '' : '--use-mock-keychain',
]

/** 默认的 Firefox 浏览器启动参数 */
export const firefoxDefaultCLIArgs = [
  '--marionette',
  '--remote-debugging-port=0',
]

/** 判断是否为 Firefox 内核（兼容大小写） */
function isFirefoxCore(coreType?: CoreType | string) {
  return String(coreType ?? '').toLowerCase() === CoreType.Firefox.toLowerCase()
}

/** 需要同步的本地数据 */
export function getNeedSyncLocalFileMap(coreType: CoreType | string): Record<string, string | string[]> {
  if (isFirefoxCore(coreType)) {
    return {
      /** IndexedDB同步：storage/default/<origin>/idb/*.sqlite */
      syncIndexedDb: '/storage/default',
      /** Local Storage同步：storage/default/<origin>/ls/data.sqlite */
      syncLocalStorage: '/storage/default',
      /** 书签同步 */
      syncBookmark: ['/places.sqlite', '/places.sqlite-wal', '/places.sqlite-shm'],
      /** 历史记录与书签共用 places.sqlite，保持同名键以便上层勾选时一并打包 */
      syncHistory: ['/places.sqlite', '/places.sqlite-wal', '/places.sqlite-shm'],
      /** Session Storage 同步：Firefox 的 sessionStorage 存放在 sessionstore 目录下 */
      syncSessionStorage: ['/sessionstore.jsonlz4', '/sessionstore-backups'],
    }
  }

  return {
    /** IndexedDb 同步 */
    syncIndexedDb: '/Default/IndexedDB',
    /** Local Storage同步 */
    syncLocalStorage: '/Default/Local Storage',
    /** 书签同步 */
    syncBookmark: '/Default/Bookmarks',
    /** 历史记录同步 */
    syncHistory: '/Default/History',
    /** Session Storage 同步 */
    syncSessionStorage: '/Default/sessionstorage.sqlite',
    /** 扩展应用数据同步 */
    syncExtensions: [
      '/Default/Local Extension Settings',
      '/Default/databases',
      '/Default/Managed Extension Settings',
      '/Default/Sync Extension Settings',
    ],
  }
}

/** 清除本地缓存（扩展数据除外） - Chrome 专用 */
export const cacheToClear = [
  'Local Extension Settings',
  'databases',
  'Managed Extension Settings',
  'Sync Extension Settings',
  'Extensions',
  'Preferences',
  'Secure Preferences',
] as const

/** Firefox 清除本地缓存时需要保留的关键文件 / 目录 */
export const firefoxCacheToKeep = [
  'extensions',
  'extension-store',
  'extension-preferences.json',
  'addonStartup.json.lz4',
] as const

/** 无效的 URL, 无须同步 */
export function getInvalidUrls() {
  return [
    'chrome://newtab/',
    'chrome-extension://',
    'about:blank',
    ...getLocalWebServerURL(),
  ]
}

/** 本地 web 服务 URL */
export function getLocalWebServerURL() {
  return [
    import.meta.env.VITE_DEV_SERVER_URL,
    `http://localhost:${store.appPort}`,
    `http://127.0.0.1:${store.appPort}`,
    store.lastWebDomain || '',
  ]
}

/** 是否为本地 web 服务 URL */
export function isLocalWebServerURL(fullUrl: string) {
  return getLocalWebServerURL().some(url => fullUrl.startsWith(url))
}
