import { debounce } from 'es-toolkit'
import { readFile, writeFile } from 'node:fs/promises'
import { API } from '/@/api'
import { appConfig } from '/@/constants'
import { createTray } from '/@/modules/app/tray'
import { fileExists } from '/@/utils/file'
import ejs from "ejs";
import { join } from 'node:path'
import { isPackaged } from '/@/utils'

export interface StoreType {
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
  /** 是否提示商业化弹窗 */
  isShowBusinessDialog?: boolean
}

const defaultValues: StoreType = {
  language: 'en',
  closeSoft: 'pop',
  memoryLimit: 95,
  browserCacheRootDir: appConfig.defaultBrowserCacheRootDir,
  systemProxySwitch: true,
  v2raySwitch: true,
  appPort: 45535,
  ipBlackList: [],
  blockDomainList: [],
  ipChecker: 'http://iprust.io/ip.json',
  isExternalWeb: false,
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
}, 300)

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
    const config = await readFile(appConfig.configFile, 'utf-8').catch(err => {
      store.isShowBusinessDialog = false
      return Promise.reject(err)
    })
    const lastStore = JSON.parse(config)
    // 如果没有商业化弹窗配置，则默认显示
    if (!Reflect.has(lastStore, 'isShowBusinessDialog')) {
      store.isShowBusinessDialog = true
    }
    Object.assign(store, lastStore)
    await fetchUserConfig()

    // 如果语言不存在，则使用系统语言, 如果系统语言也不存在，则使用英文
    // if (!messages[store.language]) {
    //   store.language = messages[systemLanguage] ? systemLanguage : 'en'
    // }
  }
  catch (error) {
    console.error('setupStore', error)
  } finally {
    setTimeout(renderEjsFile, 2000)
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
