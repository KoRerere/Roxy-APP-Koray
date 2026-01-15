export function silentUpdateProxy(origin: Record<string, any>, params: Record<string, any>, deleteKeys?: string[]) {
  const beforeProxyInfo: Record<string, any> = {}
  const beforeProxyInfoKeys = ['beforeIp', 'beforeCity', 'beforeCountry', 'beforeTime'];
  ['lastIp', 'lastCity', 'lastCountry', 'checkTime'].forEach((key, index) => {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      beforeProxyInfo[beforeProxyInfoKeys[index]!] = origin[key]
    }
  })
  origin.beforeProxyInfo = beforeProxyInfo;

  ['moduleId', 'proxyMethod', 'checkChannel', 'checkStatus', 'checkTime', 'country', 'host', 'ipType', 'lastCity', 'lastCountry', 'lastIp', 'port', 'protocol', 'proxyCategory', 'proxyPassword', 'proxyUserName', 'refreshUrl', 'timezone', 'proxyNetwork', 'buyProxyType']
    .forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(params, key)) {
        Reflect.set(origin, key, params[key])
      }
    })

  deleteKeys?.forEach((key) => {
    Reflect.deleteProperty(origin, key)
  })
}

export function silentUpdateAccount(
  origin: Record<string, any>,
  list: Record<string, any>[],
  targetKey = 'windowPlatformList',
) {
  Reflect.set(origin, targetKey, list.map((item) => {
    return ['id', '_tempId', 'platformEfa', 'platformName', 'platformIcon', 'platformIconDark', 'platformPassword', 'platformUrl', 'platformUserName', 'platformRemarks']
      .reduce((acc, key) => {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          acc[key] = item[key]
        }
        return acc
      }, {} as Record<string, any>)
  }))
}

export const clearProxyKeys = ['host', 'ipType', 'port', 'proxyPassword', 'proxyUserName', 'refreshUrl']
