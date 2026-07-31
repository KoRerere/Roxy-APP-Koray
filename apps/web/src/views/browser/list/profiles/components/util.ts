/** 更新代理字段前先写入 before* 快照（字段一一对应 last* / checkTime） */
import { format } from 'date-fns'
import { ProxyCheckStatus } from '/@/enums'

const PROXY_BEFORE_SNAPSHOT: readonly [from: string, before: string][] = [
  ['lastIp', 'beforeIp'],
  ['lastCity', 'beforeCity'],
  ['lastCountry', 'beforeCountry'],
  ['checkTime', 'beforeTime'],
]

/** 允许从 params 静默合并到本地行的代理相关字段（白名单） */
const SILENT_PROXY_KEYS = [
  'moduleId',
  'proxyMethod',
  'checkChannel',
  'checkStatus',
  'checkTime',
  'country',
  'host',
  'ipType',
  'lastCity',
  'lastCountry',
  'lastIp',
  'port',
  'protocol',
  'proxyCategory',
  'proxyPassword',
  'proxyUserName',
  'refreshUrl',
  'timezone',
  'proxyNetwork',
  'buyProxyType',
  'isDirect',
  'isEncryptProxy',
  'proxyEncryptInfo',
] as const

export const clearProxyKeys = ['host', 'ipType', 'port', 'proxyPassword', 'proxyUserName', 'refreshUrl']

/** 加密代理字段：仅 params 显式携带时写入；清除只在 replaceProxy 且新数据未标明加密时发生 */
const ENCRYPT_PROXY_KEYS = ['isEncryptProxy', 'proxyEncryptInfo'] as const

export interface SilentUpdateProxyOptions {
  /**
   * 是否同步加密态，默认 true。
   * - true：params.isEncryptProxy 为真则保留已合并加密字段，否则清除旧加密信息
   * - false：测速 / 启动回写等局部更新，缺失加密字段不清除
   */
  replaceProxy?: boolean
}

export function silentUpdateProxy(
  origin: Record<string, any>,
  params: Record<string, any>,
  options?: SilentUpdateProxyOptions,
) {
  const { replaceProxy = true } = options ?? {}
  const beforeProxyInfo: Record<string, any> = {}
  for (const [fromKey, beforeKey] of PROXY_BEFORE_SNAPSHOT) {
    if (Object.hasOwn(params, fromKey))
      beforeProxyInfo[beforeKey] = origin[fromKey]
  }
  origin.beforeProxyInfo = beforeProxyInfo

  for (const key of SILENT_PROXY_KEYS) {
    if (Object.hasOwn(params, key))
      origin[key] = params[key]
  }

  if (replaceProxy && !params.isEncryptProxy) {
    for (const key of ENCRYPT_PROXY_KEYS)
      delete origin[key]
  }
}

export function silentUpdateAccount(
  origin: Record<string, any>,
  list: Record<string, any>[],
  targetKey = 'windowPlatformList',
) {
  Reflect.set(origin, targetKey, list.map((item) => {
    return ['id', '_tempId', 'platformEfa', 'platformName', 'platformIcon', 'platformIconDark', 'platformPassword', 'platformUrl', 'platformUserName', 'platformRemarks']
      .reduce((acc, key) => {
        if (Object.hasOwn(item, key)) {
          acc[key] = item[key]
        }
        return acc
      }, {} as Record<string, any>)
  }))
}

/** 将启动后检测到的代理信息映射为可静默合并的字段 */
export function mapOpenedProxyInfoToSilentParams(proxyInfo: Record<string, any> | undefined | null) {
  if (!proxyInfo?.ip)
    return null
  return {
    lastIp: proxyInfo.ip ?? '',
    lastCity: proxyInfo.city ?? '',
    lastCountry: proxyInfo.country_code ?? '',
    timezone: proxyInfo.timezone ?? '',
    checkStatus: ProxyCheckStatus.success,
    checkTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
  }
}
