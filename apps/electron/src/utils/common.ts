import { app } from 'electron'

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
