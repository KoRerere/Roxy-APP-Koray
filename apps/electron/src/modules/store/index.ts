import { app } from 'electron'
import Store from 'electron-store'
import { join } from 'node:path'
import { API } from '/@/api'
import { fileExists } from '/@/utils/file'

interface StoreType {
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
  /** 浏览器工作台端口号 */
  dashboardPort: number
  /** 不走代理的地址 - google会导致代理被墙，开发环境默认加上 */
  ipBlackList: string[]
}

const sessionDir = app.getPath('sessionData')

const defaultValues: StoreType = {
  closeSoft: 'pop',
  memoryLimit: 95,
  browserCacheRootDir: join(sessionDir, 'browser-cache'),
  systemProxySwitch: true,
  dashboardPort: 45535,
  ipBlackList: [],
}

const _store = new Store<StoreType>({
  defaults: {
    ...defaultValues,
  },
})

let latestStore = { ..._store.store }
console.log('latestStore', JSON.stringify(latestStore))

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
})

export async function setupStore() {
  try {
    const { data } = await API.base.userGetUserConfigList()
    Object.keys(data).forEach((key) => {
      if (Reflect.has(store, key)) {
        Reflect.set(store, key, Reflect.get(data, key))
      }
    })
  }
  catch (error) {
    console.error('setupStore userGetUserConfigList', error)
  }

  const isExists = await fileExists(latestStore.browserCacheRootDir)
  if (!isExists) {
    latestStore.browserCacheRootDir = defaultValues.browserCacheRootDir
  }
}
