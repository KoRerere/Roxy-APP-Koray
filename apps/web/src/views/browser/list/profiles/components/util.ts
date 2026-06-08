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

export function silentUpdateProxy(origin: Record<string, any>, params: Record<string, any>, deleteKeys?: string[]) {
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

  if (deleteKeys) {
    for (const key of deleteKeys)
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
