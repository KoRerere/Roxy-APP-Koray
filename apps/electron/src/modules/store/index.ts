import type { StoreType } from './types'
import { syncAutoStart } from '/@/modules/app/auto-start'
import { createTray } from '/@/modules/app/tray'
import { _store, autoSaveConfig, fetchUserConfig, initLanguage, initLocalConfigPromise, restoreLastWindowOpenStatus } from './util'

export * from './util'

export const store = new Proxy<StoreType>(_store, {
  set<K extends keyof StoreType>(target: StoreType, prop: K, value: StoreType[K], receiver: StoreType) {
    // 语言变更时，重新创建托盘
    if (prop === 'language' && value !== target.language) {
      setTimeout(createTray)
    }
    // 同步开机自启
    if (prop === 'autoStart' && value !== target.autoStart) {
      void syncAutoStart(Boolean(value))
    }
    autoSaveConfig()
    return Reflect.set(target, prop, value, receiver)
  },
})

/** 初始化 store 的 promise */
export const initStorePromise = Promise.withResolvers<void>()

async function initStore() {
  try {
    await initLocalConfigPromise.promise
    await fetchUserConfig()
    // 如果语言不存在，则使用系统语言, 如果系统语言也不存在，则使用英文
    // if (!messages[store.language]) {
    //   store.language = messages[systemLanguage] ? systemLanguage : 'en'
    // }
  }
  catch (error) {
    console.error('setupStore', error)
  }
  finally {
    await syncAutoStart(Boolean(store.autoStart))
    initLanguage()
    setTimeout(createTray)
    restoreLastWindowOpenStatus()
  }
}

export const setupStore = new Proxy(initStore, {
  async apply(target, thisArg) {
    await target.apply(thisArg)
    initStorePromise.resolve()
    return initStorePromise.promise
  },
})
