import { isMac } from '/@/constants/common'
import { store } from '/@/modules/store'

/** 默认的浏览器启动参数 */
export const defaultCLIArgs = [
  '--disable-background-mode',
  '--disable-popup-blocking',
  '--no-first-run',
  '--no-default-browser-check',
  '--remote-debugging-port=0',
  isMac ? '' : '--use-mock-keychain',
]

/** 需要同步的本地数据 */
export function getNeedSyncLocalFileMap(coreType: 'firefox' | 'chrome'): Record<string, string | string[]> {
  if (coreType === 'firefox') {
    return {
      /** IndexedDB同步 */
      syncIndexedDb: '',
      /** Local Storage同步 */
      syncLocalStorage: '/Default/Local Storage',
      /** 书签同步 */
      syncBookmark: '/Default/Bookmarks',
      /** 历史记录同步 */
      syncHistory: ['places.sqlite', 'places.sqlite-wal', 'places.sqlite-shm'],
      /** Session Storage同步 */
      syncSessionStorage: '/Default/sessionstorage.sqlite',
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

/** 清除本地缓存（扩展数据除外） */
export const cacheToClear = [
  'Local Extension Settings',
  'databases',
  'Managed Extension Settings',
  'Sync Extension Settings',
  'Extensions',
  'Preferences',
  'Secure Preferences',
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
  ]
}

/** 是否为本地 web 服务 URL */
export function isLocalWebServerURL(fullUrl: string) {
  return getLocalWebServerURL().some(url => fullUrl.startsWith(url))
}
