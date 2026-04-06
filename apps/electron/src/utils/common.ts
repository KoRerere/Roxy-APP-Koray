import type { UserGetLoginInfoListData } from '@roxy/backend-api'
import { format } from 'date-fns'
import { app } from 'electron'
import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { userInfo } from 'node:os'
import { URL } from 'node:url'
import { osConfig } from '/@/constants'
import { isLinux, isMac } from '/@/constants/common'
import { fileOperations } from '/@/modules/fileOperations'
import { initStorePromise, store } from '/@/modules/store'
import { detectNetwork } from '/@/utils'

const webReadyPromise = Promise.withResolvers<true>()

/** 前端是否准备就绪 */
export const isWebReady = () => webReadyPromise.promise
/** 前端已经准备就绪 */
export const setWebReady = () => webReadyPromise.resolve(true)

export function safeStringify(obj) {
  const seen = new WeakSet()
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]'
      }
      seen.add(value)
    }
    return value
  })
}

export function safeParseJSON(str: string, fallback?: () => any) {
  try {
    return JSON.parse(str)
  }
  catch (error) {
    console.debug('safeParseJSON', error)
    return fallback?.() ?? null
  }
}

export function safeGetURL(url: string) {
  try {
    return new URL(url)
  }
  catch (error) {
    return null
  }
}

/** 2fa 剩余有效时间 */
export function calculateRemainingTime(timeStep = 30) {
  const currentTime = Math.floor(Date.now() / 1000)
  const remainingTime = timeStep - (currentTime % timeStep)
  return remainingTime
}

export type CommonRequestHeaders = ReturnType<typeof getCommonRequestHeaders>
export function getCommonRequestHeaders() {
  return {
    'source': 'app',
    'appVersion': app.getVersion(),
    'osVersion': osConfig.osVersion,
    'R-OS': isMac ? 'mac' : (isLinux ? 'linux' : 'win'),
    'R-OSBIT': isMac ? osConfig.cpu : osConfig.osBit,
    // ['R-DEVICE-ID']: await getDeviceId(),
    'R-DEVICE-NAME': encodeURIComponent(getSystemUserName()),
    'R-Local-Timezone-Offset': Intl.DateTimeFormat().resolvedOptions().timeZone,
    'R-Local-System-Language': app.getLocale(),
  }
}

/** 生成设备 ID */
async function genDeviceId() {
  const deviceInfo = await fileOperations.executeTask('getDeviceInfo', undefined)
  store.mac ||= deviceInfo.macs[0]
  const uniqueString = `${deviceInfo.os}-${deviceInfo.hardware}-${store.mac}-${deviceInfo.serialNum}`
  const deviceId = createHash('sha256').update(uniqueString).digest('hex')
  return deviceId
}

/** 获取设备唯一 ID */
export const getDeviceId = (() => {
  const { promise, resolve } = Promise.withResolvers<string>()

  queueMicrotask(async () => {
    await initStorePromise.promise

    if (!store.deviceId) {
      // 如果 15s 内没有获取到设备 ID，则生成一个随机 ID
      const timer = setTimeout(() => {
        store.deviceId ||= randomUUID()
        console.debug('Device ID not obtained within 15s, generating random ID:', store.deviceId)
        resolve(store.deviceId)
      }, 1000 * 15)

      console.time('Time taken to obtain device ID')
      store.deviceId ||= await genDeviceId()
      resolve(store.deviceId)
      console.timeEnd('Time taken to obtain device ID')
      console.debug('Unique device ID:', store.deviceId)
      clearTimeout(timer)
    }
    else {
      console.debug('Device ID already exists', store.deviceId)
      if (!store.mac) {
        store.deviceId = await genDeviceId()
      }
    }
  })

  return () => {
    if (store.deviceId) {
      return store.deviceId
    }
    return promise
  }
})()

export type DeviceInfo = ReturnType<typeof getDeviceInfo>

/** 获取设备信息 */
export async function getDeviceInfo(): Promise<UserGetLoginInfoListData['data'][number]> {
  const result = await detectNetwork('local')

  return {
    deviceName: getSystemUserName(),
    deviceId: await getDeviceId(),
    /** 用户IP地址 */
    address: result.ip,
    /** 平台 */
    platform: isMac ? 'mac' : 'win',
    /** 位置 */
    location: result.city,
    /** 登录时间 */
    createTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
  }
}

/** 计算文件的 sha512 哈希值 */
export async function calculateFileHash(filePath: string) {
  const fileBuffer = await readFile(filePath)
  const hashSum = await createHash('sha512')
  hashSum.update(fileBuffer)

  return hashSum.digest('hex')
}

export function getUTCOffsetHours() {
  /**
   * 负号，转换为正偏移
   */
  const offsetMinutes = -new Date().getTimezoneOffset()
  return offsetMinutes / 60
}

/** 异步的 debounce */
export function asyncDebounce<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timer: NodeJS.Timeout | null = null
  let pendingResolvers: Array<{
    resolve: (value: ReturnType<T>) => void
    reject: (error: any) => void
    args: Parameters<T>
  }> = []

  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return new Promise<ReturnType<T>>((resolve, reject) => {
      // 添加到待处理列表
      pendingResolvers.push({ resolve, reject, args })

      // 清除之前的 timer
      if (timer) {
        clearTimeout(timer)
      }

      // 设置新的 timer，使用最后一次调用的参数
      timer = setTimeout(async () => {
        const lastCall = pendingResolvers.at(-1)
        const allResolvers = [...pendingResolvers]
        pendingResolvers = [] // 清空列表

        try {
          const result = await fn(...lastCall.args)
          // 所有等待的调用者都收到相同结果（使用最后的参数）
          allResolvers.forEach(({ resolve }) => resolve(result))
        }
        catch (error) {
          // 所有等待的调用者都收到相同错误
          allResolvers.forEach(({ reject }) => reject(error))
        }
      }, delay)
    })
  }
}

/**
 * 获取系统用户名
 */
export function getSystemUserName() {
  return userInfo().username
}
