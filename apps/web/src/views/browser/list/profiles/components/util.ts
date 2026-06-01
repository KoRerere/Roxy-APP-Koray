/** 更新代理字段前先写入 before* 快照（字段一一对应 last* / checkTime） */
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

export const clearProxyKeys = ['host', 'ipType', 'port', 'proxyPassword', 'proxyUserName', 'refreshUrl']
