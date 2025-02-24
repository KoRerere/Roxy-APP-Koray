import { app } from 'electron'
import { osConfig } from '/@/constants'
import { hostname } from 'node:os'
import { createHash } from 'node:crypto'
import { UserGetLoginInfoListData } from '@roxy/backend-api'
import { detectNetwork } from '/@/utils'
import { format } from 'date-fns'
import { fileOperations } from '/@/modules/fileOperations'
import { initStorePromise, store } from '/@/modules/store'
import { readFile } from 'node:fs/promises'

const webReadyPromise = Promise.withResolvers<true>()

/** 是否处于开发环境 */
export const isDev = import.meta.env.DEV
/** 是否处于生产环境 */
export const isProd = import.meta.env.PROD
/** 是否处于打包状态 */
export const isPackaged = app.isPackaged

export const isMac = process.platform === 'darwin'
export const isWindows = process.platform === 'win32'

/** 前端是否准备就绪 */
export const isWebReady = () => webReadyPromise.promise
/** 前端已经准备就绪 */
export const setWebReady = () => webReadyPromise.resolve(true)

console.log('isDev', isDev)

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


/** 2fa 剩余有效时间 */
export const calculateRemainingTime = (timeStep = 30) => {
  const currentTime = Math.floor(Date.now() / 1000);
  const remainingTime = timeStep - (currentTime % timeStep);
  return remainingTime;
};

export type CommonRequestHeaders = ReturnType<typeof getCommonRequestHeaders>
export function getCommonRequestHeaders() {
  return {
    source: 'app',
    appVersion: app.getVersion(),
    osVersion: osConfig.osVersion,
    ['R-OS']: isMac ? 'mac' : 'win',
    ['R-OSBIT']: isMac ? osConfig.cpu : osConfig.osBit,
    // ['R-DEVICE-ID']: await getDeviceId(),
    ['R-DEVICE-NAME']: encodeURIComponent(hostname()),
  }
}

/** 获取设备唯一 ID */
export const getDeviceId = (() => {
  let genDeviceIdPromise

  queueMicrotask(() => {
    initStorePromise.promise.then(() => {
      if (!store.deviceId) {
        genDeviceIdPromise = fileOperations.executeTask('genDeviceId', undefined)
      } else {
        console.log('设备 ID 已存在', store.deviceId)
      }
    })
  })

  return async () => {
    if (store.deviceId) {
      return store.deviceId
    }
    const { promise, resolve } = Promise.withResolvers<string>()
    if (!store.deviceId) {
      // 如果 10s 内没有获取到设备 ID，则生成一个随机 ID
      const timer = setTimeout(() => {
        store.deviceId = crypto.randomUUID()
        console.log('10s 内没有获取到设备 ID，随机生成：', store.deviceId)
        resolve(store.deviceId)
      }, 10000)
      console.time('获取设备 ID 耗时')
      genDeviceIdPromise?.then((deviceId) => {
        store.deviceId ||= deviceId
        resolve(store.deviceId!)
        clearTimeout(timer)
        console.timeEnd('获取设备 ID 耗时')
        console.log("设备唯一 ID:", store.deviceId);
      })
    } else {
      resolve(store.deviceId)
    }

    return promise;
  }
})()

export type DeviceInfo = ReturnType<typeof getDeviceInfo>

/** 获取设备信息 */
export async function getDeviceInfo(): Promise<UserGetLoginInfoListData['data'][number]> {
  const result = await detectNetwork('local')

  return {
    deviceName: hostname(),
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
  const fileBuffer = await readFile(filePath);
  const hashSum = await createHash('sha512');
  hashSum.update(fileBuffer);

  return hashSum.digest('hex');
}
