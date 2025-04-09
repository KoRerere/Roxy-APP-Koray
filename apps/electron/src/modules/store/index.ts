import { debounce } from 'es-toolkit'
import { readFile, writeFile } from 'node:fs/promises'
import { API } from '/@/api'
import { appConfig } from '/@/constants'
import { createTray } from '/@/modules/app/tray'
import { fileExists } from '/@/utils/file'
import ejs from "ejs";
import { join } from 'node:path'
import { isPackaged } from '/@/utils'
import { loadLocaleMessages } from '/@/locales'
import { app } from 'electron'
import { UserGetSearchEnginesListData } from '@roxy/backend-api'

export interface StoreType {
  language: string
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
  /** roxynet 本地 http 服务端口 */
  roxynetLocalHttpPort?: number
  /** roxynet 代理端口 */
  roxynetProxyPort?: number
  /** roxynet v2ray 兼容模式 */
  v2raySwitch?: boolean
  /** APP 本地服务端口 */
  appPort: number
  /** openapi key */
  apiKey?: string
  /** openapi 端口 */
  apiPort?: number
  /** 不走代理的地址 - google会导致代理被墙，开发环境默认加上 */
  ipBlackList: string[]
  /** 域名禁止访问 */
  blockDomainList: string[]
  /** Default IP checker */
  ipChecker: string
  /** 是否使用外置 web 资源 */
  isExternalWeb: boolean
  /** 设备 ID */
  deviceId?: string
  /** 是否开启工作台, 0: 不开启, 1: 开启*/
  openWorkbench?: 0 | 1
  /** 搜索引擎列表 */
  searchEngines: UserGetSearchEnginesListData['data']
}

const defaultValues: StoreType = {
  language: '',
  closeSoft: 'pop',
  memoryLimit: 95,
  browserCacheRootDir: appConfig.defaultBrowserCacheRootDir,
  systemProxySwitch: true,
  v2raySwitch: true,
  appPort: 45535,
  ipBlackList: [],
  blockDomainList: [],
  ipChecker: '',
  isExternalWeb: false,
  openWorkbench: 1,
  searchEngines: [],
}

const _store: StoreType = {
  ...defaultValues,
}

console.log('_store', JSON.stringify(_store, null, 2))

const saveConfig = debounce(async () => {
  const isExists = await fileExists(_store.browserCacheRootDir)
  if (!isExists) {
    _store.browserCacheRootDir = defaultValues.browserCacheRootDir
  }
  try {
    await writeFile(appConfig.configFile, JSON.stringify(_store, null, 2), 'utf-8')
  }
  catch (error) {
    console.error('saveConfig error: ', error)
  }
}, 100)

export const store = new Proxy(_store, {
  set(target, prop: keyof StoreType, value) {
    // 语言变更时，重新创建托盘
    if (prop === 'language' && value !== target.language) {
      setTimeout(createTray)
    }
    // appPort 变化的时候重新生成 blockDomainPageFile
    if (prop === 'appPort' && value !== target.appPort) {
      setTimeout(renderEjsFile)
    }
    saveConfig()
    return Reflect.set(_store, prop, value, target)
  },
})

/** 获取用户远程软件配置 */
export async function fetchUserConfig() {
  try {
    // 启动时，获取用户配置
    const { code, data } = await API.base.userGetUserConfigList()
    if (code === 0) {
      console.log('setupStore userGetUserConfigList', data)
      Object.keys(data).forEach((key) => {
        // 如果语言存在，则不覆盖
        if (key === 'language' && store.language) {
          return
        }
        if (Reflect.has(store, key)) {
          Reflect.set(store, key, Reflect.get(data, key))
        }
      })
    }
  }
  catch (error) {
    console.error('setupStore userGetUserConfigList', error)
  }
}

async function initStore() {
  try {
    const config = await readFile(appConfig.configFile, 'utf-8')
    const lastStore = JSON.parse(config)
    Object.assign(store, lastStore)
    await fetchUserConfig()
    updateSearchEngines()
    // 如果语言不存在，则使用系统语言, 如果系统语言也不存在，则使用英文
    // if (!messages[store.language]) {
    //   store.language = messages[systemLanguage] ? systemLanguage : 'en'
    // }
  }
  catch (error) {
    console.error('setupStore', error)
  } finally {
    initLanguage()
    setTimeout(createTray)
    setTimeout(renderEjsFile, 2000)
  }
}

/** 初始化 store 的 promise */
export const initStorePromise = Promise.withResolvers<void>()

export const setupStore = new Proxy(initStore, {
  async apply(target, thisArg) {
    await target.apply(thisArg)
    initStorePromise.resolve()
    return initStorePromise.promise
  },
})

async function initLanguage() {
  await app.whenReady()
  const systemLanguage = app.getLocale().split('-')[0]
  const defaultLanguage = systemLanguage === 'zh' ? 'zh-CN' : systemLanguage
  store.language ||= defaultLanguage
  const canLoad = loadLocaleMessages(store.language)
  if (!canLoad) {
    store.language = 'en'
  }
}

/** appPort 变化的时候重新生成 */
async function renderEjsFile() {
  if (!isPackaged) return

  const baseUrl = `http://127.0.0.1:${store.appPort}`
  const basePath = store.isExternalWeb ? appConfig.externalWebDir : appConfig.buildInWebDir

  // 生成 blockDomain.html 给内核 blockDomainPageFile 使用
  ejs.renderFile(join(basePath, 'blockDomain.ejs'), { baseUrl }, (err, str) => {
    writeFile(join(basePath, 'blockDomain.html'), str)
  })
}

/** 更新搜索引擎 */
export async function updateSearchEngines() {
  const { code, data } = await API.platform.userGetSearchEnginesList()
  if (code === 0) {
    store.searchEngines = data
  }
}