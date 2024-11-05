import { debounce } from 'es-toolkit'
import { readFile, writeFile } from 'node:fs/promises'
import { API } from '/@/api'
import { appConfig } from '/@/constants'
import { fileExists } from '/@/utils/file'

export interface StoreType {
  language: 'zh-CN' | 'en' | 'es' | 'ja' | 'fr' | 'ko' | 'pl' | 'ru' | 'tr' | 'de'
  /** 浏览器文件缓存根目录 */
  cacheDir: string
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
  /** luminet v2ray 兼容模式 */
  roxynetV2rayCompatible?: boolean
  /** APP 本地服务端口 */
  appPort: number
  /** openapi key */
  apiKey?: string
  /** 不走代理的地址 - google会导致代理被墙，开发环境默认加上 */
  ipBlackList: string[]
  /** Default IP checker */
  ipChecker: string
}

const defaultValues: StoreType = {
  language: 'en',
  closeSoft: 'pop',
  memoryLimit: 95,
  cacheDir: appConfig.defaultBrowserCacheRootDir,
  systemProxySwitch: true,
  roxynetV2rayCompatible: false,
  appPort: 45535,
  ipBlackList: [],
  ipChecker: 'http://iprust.io/ip.json',
}

const _store: StoreType = {
  ...defaultValues,
}

console.log('_store', JSON.stringify(_store, null, 2))

const saveConfig = debounce(async () => {
  const isExists = await fileExists(_store.cacheDir)
  if (!isExists) {
    _store.cacheDir = defaultValues.cacheDir
  }
  try {
    await writeFile(appConfig.configFile, JSON.stringify(_store, null, 2), 'utf-8')
  }
  catch (error) {
    console.error('saveConfig error: ', error)
  }
}, 300)

export const store = new Proxy(_store, {
  set(target, prop: keyof StoreType, value) {
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

export async function setupStore() {
  try {
    const config = await readFile(appConfig.configFile, 'utf-8')
    Object.assign(store, JSON.parse(config))
  }
  catch (error) {
    console.error('setupStore', error)
  }
  await fetchUserConfig()
}
