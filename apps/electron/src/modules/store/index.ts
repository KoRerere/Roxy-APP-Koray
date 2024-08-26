import { join } from 'node:path'
import type { UserGetUserInfoListData } from '@roxy/backend-api'
import { app } from 'electron'
import Store from 'electron-store'
import { fileExists } from '/@/utils/file'
import { API } from '/@/api'

interface StoreType {
  browserCacheRootDir: string
  userInfo: UserGetUserInfoListData['data']
}

const sessionDir = app.getPath('sessionData')

const defaultValues = {
  browserCacheRootDir: join(sessionDir, 'browser-cache'),
  userInfo: {} as UserGetUserInfoListData['data'],
}

const _store = new Store<StoreType>({
  defaults: {
    ...defaultValues,
  },
})

let latestStore = { ..._store.store }

_store.onDidAnyChange((newValue) => {
  latestStore = newValue!
})

export const store = new Proxy(latestStore, {
  get(target, prop) {
    return target[prop]
  },
  set(target, prop: keyof StoreType, value) {
    _store.set(prop, value)
    return true
  },
})

export async function setupStore() {
  API.base.userGetUserInfoList().then((res) => {
    if (res.data) {
      store.userInfo = res.data
    }
  })

  const isExists = await fileExists(latestStore.browserCacheRootDir)
  if (!isExists) {
    latestStore.browserCacheRootDir = defaultValues.browserCacheRootDir
  }
}
