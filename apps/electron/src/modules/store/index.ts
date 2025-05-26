import { debounce } from 'es-toolkit'
import { readFile, writeFile } from 'node:fs/promises'
import { API } from '/@/api'
import { appConfig } from '/@/constants'
import { createTray } from '/@/modules/app/tray'
import { fileExists } from '/@/utils/file'
import { loadLocaleMessages } from '/@/locales'
import { app } from 'electron'
import crypto from 'node:crypto'
import { safeParseJSON } from '/@/utils'

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
  /** 订阅等级 */
  subLevel?: string
  simulation: {
    delay: 100,
    enable: false,
    shortcutKey: "Shift E"
  }
  /** 是否开启谷歌账号登录 */
  googleLoginEnable?: boolean
  /** 是否开启 IP 变化提示 */
  ipChangeModal?: boolean
  /** 是否显示新功能提示 */
  showNewFeatureTips?: boolean
  /** 浏览器主题 */
  browserColorScheme?: 'light' | 'dark' | 'system'
}

/** 全局书签 */
let bookText: Record<string, any>

export function getBookText() {
  return bookText
}

export function setBookText(value: Record<string, any>) {
  // console.log('setBookText', value)
  bookText = value
}

const excludeKeys = ['bookText']

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
  subLevel: '',
  simulation: {
    delay: 100,
    enable: false,
    shortcutKey: "Shift E"
  },
  googleLoginEnable: false,
  ipChangeModal: false,
  showNewFeatureTips: true,
  browserColorScheme: 'system',
}

const _store: StoreType = {
  ...defaultValues,
}

console.debug('_store', JSON.stringify(_store, null, 2))

/** 加密密钥，使用 PBKDF2 生成固定长度的密钥 */
const SALT = 'roxy-browser-salt' // 盐值
const KEY_LENGTH = 32 // AES-256 需要 32 字节密钥
const ITERATIONS = 10000 // PBKDF2 迭代次数
// 使用固定的密码生成密钥，实际应用中应该使用更安全的方式
const password = 'roxy-browser-default-password'

/** 生成加密密钥 */
function generateEncryptionKey(): Buffer {
  return crypto.pbkdf2Sync(password, SALT, ITERATIONS, KEY_LENGTH, 'sha256')
}

/** 加密数据 */
function encryptData(data: string): string {
  try {
    const key = generateEncryptionKey()
    const iv = crypto.randomBytes(16) // 生成随机 IV
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)

    // 加密数据
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    // 将 IV 和加密数据组合在一起
    return `${iv.toString('hex')}:${encrypted}`
  } catch (error) {
    console.error('加密数据失败:', error)
    throw error
  }
}

/** 解密数据 */
function decryptData(encryptedData: string): string {
  try {
    const key = generateEncryptionKey()
    // 分离 IV 和加密数据
    const [ivHex, encrypted] = encryptedData.split(':')
    const iv = Buffer.from(ivHex, 'hex')

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (error) {
    console.error('解密数据失败:', error)
    throw error
  }
}

export const forceSaveConfig = async () => {
  const isExists = await fileExists(_store.browserCacheRootDir)
  if (!isExists) {
    _store.browserCacheRootDir = defaultValues.browserCacheRootDir
  }
  try {
    // 加密数据后再保存
    const jsonData = JSON.stringify(_store, null, 2)
    const encryptedData = encryptData(jsonData)
    await writeFile(appConfig.configFile, encryptedData, 'utf-8')
  }
  catch (error) {
    console.error('saveConfig error: ', error)
  }
}

const autoSaveConfig = debounce(forceSaveConfig, 60)

export const store = new Proxy(_store, {
  set(target, prop: keyof StoreType, value) {
    // 语言变更时，重新创建托盘
    if (prop === 'language' && value !== target.language) {
      setTimeout(createTray)
    }
    autoSaveConfig()
    return Reflect.set(_store, prop, value, target)
  },
})

/** 获取用户远程软件配置 */
export async function fetchUserConfig() {
  try {
    // 启动时，获取用户配置
    const { code, data } = await API.base.userGetUserConfigList()
    console.debug('fetchUserConfig result', code, data)
    if (code === 0) {
      // 如果语言存在，则不覆盖
      if (store.language) {
        Reflect.deleteProperty(data, 'language')
      }
      setUserConfig(data)
    }
  }
  catch (error) {
    console.error('setupStore userGetUserConfigList', error)
  }
}

export function setUserConfig(data: Record<string, any>) {
  Object.keys(data).forEach((key) => {
    if (excludeKeys.includes(key)) {
      return
    }
    if (Reflect.has(store, key)) {
      Reflect.set(store, key, Reflect.get(data, key))
    }
  })
  if (data?.bookText) {
    setBookText(data.bookText)
  }
}

async function initStore() {
  try {
    const encryptedConfig = await readFile(appConfig.configFile, 'utf-8')
    // 解密数据
    const lastStore = safeParseJSON(encryptedConfig, () => {
      const decryptedConfig = decryptData(encryptedConfig)
      return JSON.parse(decryptedConfig)
    })
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
    initLanguage()
    setTimeout(createTray)
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


/** 是否可以使用群控 */
export function canUseSyncControl() {
  return !['Expired', 'Free'].includes(store.subLevel!)
}
