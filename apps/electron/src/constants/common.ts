import { app } from "electron";
import { parseArgs } from "node:util";

/** 用户通过 API 调用的接口都需要带的公共请求头 */
export const openAPICommonHeaders = {
  source: 'api',
}

/** 是否处于打包状态 */
export const isPackaged = app.isPackaged

export const appCliStartArgs = (() => {
  const options = {
    /** 日志级别 */
    'roxy-log-level': {
      type: 'string',
      default: isPackaged ? 'info' : 'silly',  // 默认 info
      // default: 'info',  // 默认 info
    },
    /** 指定 APP 运行环境(dev, prod), 默认不指定, 则根据环境变量判断 */
    'roxy-env': {
      type: 'string',
      default: '',
    },
  } as const

  const args = parseArgs({
    options,
    strict: false, // 默认 true，遇到未知参数会报错
  });

  if (import.meta.env.DEV) {
    console.log('appCliStartArgs', args)
  }

  return args.values
})()

/** 是否处于调试模式 */
export const isDebugMode = appCliStartArgs['roxy-log-level'] === 'debug'
/** 是否处于开发环境 */
export const isDev = appCliStartArgs['roxy-env'] ? appCliStartArgs['roxy-env'] === 'dev' : import.meta.env.DEV
/** 是否处于生产环境 */
export const isProd = appCliStartArgs['roxy-env'] ? appCliStartArgs['roxy-env'] === 'prod' : import.meta.env.PROD

export const isMac = process.platform === 'darwin'
export const isWindows = process.platform === 'win32'

export enum Role {
  /** 查看者 */
  VIEWER = 0,
  /** 编辑者 */
  EDITOR = 1,
  /** 管理者 */
  MANAGER = 2,
  /** 拥有者 */
  OWNER = 3,
}

console.log('isDev', isDev)

