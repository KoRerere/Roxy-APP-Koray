import { join } from 'node:path'
import { app } from 'electron'
import Store from 'electron-store'
import type { UserGetUserInfoListData } from '@roxy/backend-api'
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
  userInfo: UserGetUserInfoListData['data'] & { token?: string }
}

const sessionDir = app.getPath('sessionData')

const defaultValues: StoreType = {
  closeSoft: 'pop',
  memoryLimit: 95,
  browserCacheRootDir: join(sessionDir, 'browser-cache'),
  userInfo: {} as UserGetUserInfoListData['data'],
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
  const isExists = await fileExists(latestStore.browserCacheRootDir)
  if (!isExists) {
    latestStore.browserCacheRootDir = defaultValues.browserCacheRootDir
  }
}
