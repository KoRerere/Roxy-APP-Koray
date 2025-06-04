import { app, } from 'electron'
import { osConfig, } from '/@/constants'
import { hostname } from 'node:os'
import { createHash } from 'node:crypto'
import { UserGetLoginInfoListData } from '@roxy/backend-api'
import { detectNetwork } from '/@/utils'
import { format } from 'date-fns'
import { fileOperations } from '/@/modules/fileOperations'
import { initStorePromise, store } from '/@/modules/store'
import { readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util';

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

export const appCliStartArgs = (() => {
  const options = {
    /** 日志级别 */
    'roxy-log-level': {
      type: 'string',
      default: isPackaged ? 'info' : 'silly',  // 默认 info
      // default: 'info',  // 默认 info
    },
  } as const

  const args = parseArgs({
    options,
    strict: false, // 默认 true，遇到未知参数会报错
  });

  if (isDev) {
    console.log('appCliStartArgs', args)
  }

  return args.values
})()

/** 是否处于调试模式 */
export const isDebugMode = appCliStartArgs['roxy-log-level'] === 'debug'

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
  } catch (error) {
    console.error('safeParseJSON', error)
    return fallback?.() ?? null
  }
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
    ['R-Local-Timezone-Offset']: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ['R-Local-System-Language']: app.getLocale(),
  }
}

/** 获取设备唯一 ID */
export const getDeviceId = (() => {
  const { promise, resolve } = Promise.withResolvers<string>()

  queueMicrotask(async () => {
    await initStorePromise.promise
    if (!store.deviceId) {
      // 如果 15s 内没有获取到设备 ID，则生成一个随机 ID
      const timer = setTimeout(() => {
        store.deviceId ||= crypto.randomUUID()
        console.debug('15s 内没有获取到设备 ID，随机生成：', store.deviceId)
        resolve(store.deviceId)
      }, 1000 * 15)

      console.time('获取设备 ID 耗时')
      store.deviceId ||= await fileOperations.executeTask('genDeviceId', undefined)
      resolve(store.deviceId)
      console.timeEnd('获取设备 ID 耗时')
      console.debug("设备唯一 ID:", store.deviceId)
      clearTimeout(timer)
    } else {
      console.debug('设备 ID 已存在', store.deviceId)
    }
  })

  return () => {
    if (store.deviceId) {
      return store.deviceId
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

export function getUTCOffsetHours() {
  const offsetMinutes = -new Date().getTimezoneOffset(); // 负号，转换为正偏移
  return offsetMinutes / 60;
}

/** 异步的 debounce */
export function asyncDebounce<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timer: NodeJS.Timeout | null = null;
  let pendingResolvers: Array<{
    resolve: (value: ReturnType<T>) => void;
    reject: (error: any) => void;
    args: Parameters<T>;
  }> = [];

  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return new Promise<ReturnType<T>>((resolve, reject) => {
      // 添加到待处理列表
      pendingResolvers.push({ resolve, reject, args });

      // 清除之前的 timer
      if (timer) {
        clearTimeout(timer);
      }

      // 设置新的 timer，使用最后一次调用的参数
      timer = setTimeout(async () => {
        const lastCall = pendingResolvers[pendingResolvers.length - 1];
        const allResolvers = [...pendingResolvers];
        pendingResolvers = []; // 清空列表

        try {
          const result = await fn(...lastCall.args);
          // 所有等待的调用者都收到相同结果（使用最后的参数）
          allResolvers.forEach(({ resolve }) => resolve(result));
        } catch (error) {
          // 所有等待的调用者都收到相同错误
          allResolvers.forEach(({ reject }) => reject(error));
        }
      }, delay);
    });
  };
}