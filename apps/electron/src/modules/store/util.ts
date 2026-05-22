import type { StoreType } from '/@/modules/store/types'
import { getCurrentScope } from '@sentry/electron/main'
import { app } from 'electron'
import { debounce } from 'es-toolkit'
import { isEmpty } from 'es-toolkit/compat'
import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { API } from '/@/api'
import { appConfig } from '/@/constants'
import { loadLocaleMessages } from '/@/locales'
import { browserManager } from '/@/modules/browser'
import { store } from '/@/modules/store'
import { defaultValues } from '/@/modules/store/defaultConfig'
import { fileExists, getInstallerParams, killProcessByName, killProcessForce, safeParseJSON } from '/@/utils'
import { absoluteTopLeftToWindowRatioPosition, getVirtualWorkAreaUnion } from '/@/utils/windowGridLayout'

function normalizeSimulationConfig(simulation: Record<string, any> | undefined) {
  if (!simulation || typeof simulation !== 'object') {
    return defaultValues.simulation
  }

  const delayRange = Array.isArray(simulation.delayRange) && simulation.delayRange.length >= 2
    ? simulation.delayRange
    : [
        simulation.delay ?? defaultValues.simulation.delayRange[0],
        simulation.delay ?? defaultValues.simulation.delayRange[1],
      ]

  return {
    ...simulation,
    delayRange,
  }
}

/** 加密密钥，使用 PBKDF2 生成固定长度的密钥 */
/**
 * 盐值
 */
const SALT = 'roxy-browser-salt'
/**
 * AES-256 需要 32 字节密钥
 */
const KEY_LENGTH = 32
/**
 * PBKDF2 迭代次数
 */
const ITERATIONS = 10000
// 使用固定的密码生成密钥，实际应用中应该使用更安全的方式
const password = 'roxy-browser-default-password'
const excludeKeys = ['bookText', 'allWorkspaceId']

export const _store: StoreType = structuredClone(defaultValues)

/** 生成加密密钥 */
function generateEncryptionKey(): Buffer {
  return crypto.pbkdf2Sync(password, SALT, ITERATIONS, KEY_LENGTH, 'sha256')
}

/** 加密数据 */
export function encryptData(data: string): string {
  try {
    const key = generateEncryptionKey()
    /**
     * 生成随机 IV
     */
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)

    // 加密数据
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    // 将 IV 和加密数据组合在一起
    return `${iv.toString('hex')}:${encrypted}`
  }
  catch (error) {
    console.error('Failed to encrypt data:', error)
    throw error
  }
}

/**
 * 校验加密数据格式是否合法：必须满足 `<32位十六进制 IV>:<偶数位十六进制密文>` 的形式
 * 用于在解密前快速过滤掉空文件、被截断或被破坏的内容，避免抛出晦涩的 `Invalid initialization vector` 错误
 */
function isValidEncryptedFormat(encryptedData: string): boolean {
  if (typeof encryptedData !== 'string' || encryptedData.length === 0) {
    return false
  }
  const sepIdx = encryptedData.indexOf(':')
  if (sepIdx <= 0) {
    return false
  }
  const ivHex = encryptedData.slice(0, sepIdx)
  const encrypted = encryptedData.slice(sepIdx + 1)
  // IV 长度为 16 字节 = 32 个十六进制字符；密文为十六进制（长度为偶数且非空）
  return /^[0-9a-f]{32}$/i.test(ivHex) && encrypted.length > 0 && encrypted.length % 2 === 0 && /^[0-9a-f]+$/i.test(encrypted)
}

/** 解密数据 */
export function decryptData(encryptedData: string): string {
  if (!isValidEncryptedFormat(encryptedData)) {
    throw new Error('Invalid encrypted data format')
  }
  try {
    const key = generateEncryptionKey()
    const sepIdx = encryptedData.indexOf(':')
    const ivHex = encryptedData.slice(0, sepIdx)
    const encrypted = encryptedData.slice(sepIdx + 1)
    const iv = Buffer.from(ivHex, 'hex')

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }
  catch (error) {
    console.error('Failed to decrypt data:', error)
    throw error
  }
}

export async function forceSaveConfig() {
  // 确保 ~/.roxybrowser(-dev) 目录存在
  await fileExists(appConfig.roxyDataDir, true)

  writeFile(appConfig.roxyConfigFile, JSON.stringify({
    apiKey: store.apiKey,
    apiPort: store.apiPort,
    defaultBrowserDirId: store.defaultBrowserDirId,
    defaultBrowserWorkspaceId: store.defaultBrowserWorkspaceId,
    appWsPort: store.appWsPort,
    appWsToken: 'roxybrowser',
  }), 'utf-8').catch((error) => {
    console.error('save defaultBrowserConfig error: ', error)
  })

  const isExists = await fileExists(_store.browserCacheRootDir)
  if (!isExists) {
    _store.browserCacheRootDir = defaultValues.browserCacheRootDir
  }
  try {
    // 加密数据后再保存，排除 excludeKeys 中定义的 key
    const jsonData = JSON.stringify(_store, (key, value) => {
      if (excludeKeys.includes(key)) {
        return undefined
      }
      return value
    })
    const encryptedData = encryptData(jsonData)
    // 原子性写入：先写入临时文件，再 rename 替换，避免进程异常退出导致目标文件被部分写入而损坏
    const tmpFile = `${appConfig.configFile}.tmp`
    await writeFile(tmpFile, encryptedData, 'utf-8')
    await rename(tmpFile, appConfig.configFile)
  }
  catch (error) {
    console.error('saveConfig error: ', error)
  }
}

export const autoSaveConfig = debounce(forceSaveConfig, 60)

/** 初始化本地配置的 promise */
export const initLocalConfigPromise = Promise.withResolvers<void>()

export async function initLocalConfig() {
  try {
    await fileExists(appConfig.roxyDataDir, true)
    let encryptedConfig = ''
    try {
      encryptedConfig = await readFile(appConfig.configFile, 'utf-8')
    }
    catch (error: any) {
      // 配置文件不存在属于首次启动场景，直接使用默认值
      if (error?.code !== 'ENOENT') {
        console.warn('readConfig error: ', error)
      }
    }

    // 文件为空、被截断或破坏时，跳过解析，直接使用默认配置，避免抛出 Invalid initialization vector 等错误
    let lastStore: Record<string, any> | null = null
    if (encryptedConfig.length > 0) {
      lastStore = safeParseJSON(encryptedConfig, () => {
        if (!isValidEncryptedFormat(encryptedConfig)) {
          console.warn('Local config file is empty or corrupted, falling back to default config')
          return null
        }
        try {
          const decryptedConfig = decryptData(encryptedConfig)
          return JSON.parse(decryptedConfig)
        }
        catch (error) {
          console.warn('Failed to decrypt local config, falling back to default config', error)
          return null
        }
      })
    }

    if (!lastStore || typeof lastStore !== 'object') {
      lastStore = {}
    }
    lastStore.simulation = normalizeSimulationConfig(lastStore.simulation)
    Object.assign(store, lastStore)
    // 重置下次更新时间
    store.nextUpdateTimestamp = 0
    // 有用户信息，则认为有登录过
    if (store.token || store.userId || store.userInfo?.email) {
      store.hasLoggedIn = true
    }
    // 如果上次登录时间超过 15 天，则清除 token 和 userId
    if (Date.now() - store.lastLoginTime > 1000 * 60 * 60 * 24 * 15) {
      store.showLongTimeNotLoginTips = Boolean(store.token)
      store.token = ''
      Reflect.deleteProperty(store, 'userId')
      store.lastLoginTime = Date.now()
      console.log('Last login time exceeds 15 days, clearing token and userId')
    }
    else {
      store.showLongTimeNotLoginTips = false
      if (store.userInfo?.email) {
        const scope = getCurrentScope()
        scope.setUser({
          id: store.userId,
          email: store.userInfo.email,
          username: store.userInfo.username,
        })
        scope.setTag('process', 'main')
      }
    }
  }
  catch (error) {
    console.error('initLocalConfig', error)
  }
  // 没有设备 ID，则记录首次打开应用事件
  console.debug('deviceId', store.deviceId)
  if (!store.deviceId) {
    recordFirstLaunchAppEvent()
  }
  // 如果有更新器进程 ID，则杀掉更新器进程
  console.log('updaterExePid', store.updaterExePid)
  if (store.updaterExePid) {
    killProcessForce(store.updaterExePid)
    store.updaterExePid = undefined
  }
  initLocalConfigPromise.resolve()
}

/** 获取用户远程软件配置 */
export async function fetchUserConfig() {
  if (!store.token) {
    return
  }

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
  if (Reflect.has(data, 'simulation')) {
    data.simulation = normalizeSimulationConfig(data.simulation)
  }

  Object.keys(data).forEach((key) => {
    if (Reflect.has(store, key)) {
      Reflect.set(store, key, Reflect.get(data, key))
    }
  })
}

export async function initLanguage() {
  await app.whenReady()
  const systemLanguage = app.getLocale().split('-')[0]
  const defaultLanguage = systemLanguage === 'zh' ? 'zh-CN' : systemLanguage
  store.language ||= defaultLanguage
  const canLoad = loadLocaleMessages(store.language)
  if (!canLoad) {
    store.language = 'en'
  }
}

const canUseSyncControlMap: Record<number, { canUse: boolean, lastCheckTime: number }> = {}
/** 是否可以使用群控 */
export async function canUseSyncControl(force = false) {
  if (!store.workspaceId) {
    return false
  }
  const now = Date.now()
  const lastCheckTime = canUseSyncControlMap[store.workspaceId!]?.lastCheckTime || 0
  if (!force && now - lastCheckTime < 1000 * 60) {
    return canUseSyncControlMap[store.workspaceId!].canUse
  }
  const { code } = await API.pay.userCheckTeamUserRightsList()
  canUseSyncControlMap[store.workspaceId!] = {
    canUse: code === 0,
    lastCheckTime: now,
  }
  return canUseSyncControlMap[store.workspaceId!].canUse
}

/** 安装后首次打开应用，需要记录事件 */
async function recordFirstLaunchAppEvent() {
  await getInstallerParams()
  console.debug('Visitor ID:', store.visitorId)
  if (store.visitorId) {
    console.debug('User first install and open app')
    await API.appTrackingEvent.appTrackingEventCreate({
      uuid: store.visitorId,
      eventType: 'app_open',
    })
  }
}

/** 异常退出后恢复窗口函数，如果函数存在，则调用函数恢复窗口 */
let restoreLastWindowOpenStatusOnException: (() => Promise<void>) | null = null

export function getRestoreLastWindowOpenStatusOnException() {
  return restoreLastWindowOpenStatusOnException
}

export function cancelRestoreLastWindowOpenStatus() {
  restoreLastWindowOpenStatusOnException = null
}

export const restoreLastWindowOpenStatusResolver = Promise.withResolvers<void>()

/** 恢复上次窗口打开状态 */
export async function restoreLastWindowOpenStatus() {
  restoreLastWindowOpenStatusResolver.resolve()

  const appNormalExit = store.appNormalExit
  const needRestoreWindow = store.needRestoreWindow

  store.appNormalExit = false
  store.needRestoreWindow = false

  if (!store.token) {
    return
  }

  console.log('restoreLastWindowOpenStatus', store.waitingRestoreWindow, needRestoreWindow, appNormalExit)
  if (isEmpty(store.waitingRestoreWindow)) {
    return
  }

  // 如果需要恢复窗口，或者应用正常退出，则恢复窗口
  if (needRestoreWindow || appNormalExit === false) {
    try {
      const waitingRestoreWindow = structuredClone(store.waitingRestoreWindow)
      store.waitingRestoreWindow = {}

      restoreLastWindowOpenStatusOnException = async () => {
        for (const workspaceId in waitingRestoreWindow) {
          const dirIds = waitingRestoreWindow[workspaceId]

          console.log('store.waitingRestoreWindowBounds', store.waitingRestoreWindowBounds)

          const virtual = getVirtualWorkAreaUnion()

          const customParamsByDirId = dirIds.reduce((acc, dirId) => {
            const bounds = store.waitingRestoreWindowBounds?.[dirId]
            if (!bounds) {
              return acc
            }

            acc[dirId] = {
              positionSwitch: true,
              openWidth: bounds.width,
              openHeight: bounds.height,
              windowRatioPosition: absoluteTopLeftToWindowRatioPosition(bounds.left, bounds.top, virtual),
            }
            return acc
          }, {} as Record<string, { positionSwitch: boolean, openWidth: number, openHeight: number, windowRatioPosition: string }>)

          console.log('customParamsByDirId', customParamsByDirId)

          await browserManager.batchLaunch(dirIds, {
            workspaceId: Number(workspaceId),
            customParamsByDirId,
          })
        }
      }

      //  如果应用正常退出，则清空恢复窗口函数
      if (appNormalExit !== false) {
        restoreLastWindowOpenStatusOnException()
        restoreLastWindowOpenStatusOnException = null
      }
    }
    catch (error) {

    }
  }
}
