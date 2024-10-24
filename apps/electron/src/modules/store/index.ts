import { app } from 'electron'
import Store from 'electron-store'
import { join } from 'node:path'
import { API } from '/@/api'
import { fileExists } from '/@/utils/file'

interface StoreType {
  language: 'zh-CN' | 'en' | 'es' | 'ja' | 'fr' | 'ko' | 'pl' | 'ru' | 'tr' | 'de'
  /** 浏览器文件缓存根目录 */
  browserCacheRootDir: string
  /**
   * 软件关闭时
   * - pop: 弹出提示
   * - min: 最小化到托盘
   * - exit: 直接退出
   */
  closeSoft: 'pop' | 'min' | 'exit'
  /** 性能监控 */
  memoryLimit: number
  /** 用户 token */
  token?: string
  /** 用户 ID */
  userId?: number
  /** 空间 ID */
  workspaceId?: number
  /** 是否使用系统代理 */
  systemProxySwitch?: boolean
  /** luminet 本地 http 服务端口 */
  luminetLocalHttpPort?: number
  /** luminet 代理端口 */
  luminetProxyPort?: number
  /** APP 本地服务端口 */
  appPort: number
  /** openapi key */
  apiKey?: string
  /** 不走代理的地址 - google会导致代理被墙，开发环境默认加上 */
  ipBlackList: string[]
  /** Default IP checker */
  ipChecker: string
}

const sessionDir = app.getPath('sessionData')

const defaultValues: StoreType = {
  language: 'en',
  closeSoft: 'pop',
  memoryLimit: 95,
  browserCacheRootDir: join(sessionDir, 'browser-cache'),
  systemProxySwitch: true,
  appPort: 45535,
  ipBlackList: [],
  ipChecker: 'http://iprust.io/ip.json',
}

const _store = new Store<StoreType>({
  defaults: {
    ...defaultValues,
  },
})

let latestStore = { ..._store.store }
console.log('latestStore', JSON.stringify(latestStore, null, 2))

_store.onDidAnyChange((newValue) => {
  latestStore = newValue!
})

export const store = new Proxy(latestStore, {
  get(target, prop) {
    return latestStore[prop]
  },
  set(target, prop: keyof StoreType, value) {
    _store.set(prop, value)
    return true
  },
  deleteProperty(target, p) {
    _store.delete(p)
    return true
  },
})

/** 获取用户远程软件配置 */
export async function fetchUserConfig() {
  try {
    // 启动时，获取用户配置
    const { code, data } = await API.base.userGetUserConfigList()
    if (code === 0) {
      Object.keys(data).forEach((key) => {
        if (Reflect.has(store, key)) {
          Reflect.set(store, key, Reflect.get(data, key))
        }
      })
    }
  }
  catch (error) {
    console.error('setupStore userGetUserConfigList', error)
  }

  const isExists = await fileExists(latestStore.browserCacheRootDir)
  if (!isExists) {
    latestStore.browserCacheRootDir = defaultValues.browserCacheRootDir
  }
}

export async function setupStore() {
  await fetchUserConfig()
}
