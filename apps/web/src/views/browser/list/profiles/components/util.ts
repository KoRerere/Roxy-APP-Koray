export function silentUpdateProxy(origin: Record<string, any>, params: Record<string, any>) {
  ['moduleId', 'proxyMethod', 'checkChannel', 'checkStatus', 'checkTime', 'country', 'createTime', 'host', 'ipType', 'lastCity', 'lastCountry', 'lastIp', 'port', 'protocol', 'proxyCategory', 'proxyPassword', 'proxyUserName', 'refreshUrl', 'updateTime', 'timezone', 'proxyNetwork']
    .forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(params, key)) {
        Reflect.set(origin, key, params[key])
      }
    })
}

export function silentUpdateAccount(
  origin: Record<string, any>,
  list: Record<string, any>[],
  targetKey = 'windowPlatformList',
) {
  Reflect.set(origin, targetKey, list.map((item) => {
    return ['id', '_tempId', 'platformEfa', 'platformIcon', 'platformPassword', 'platformUrl', 'platformUserName', 'platformRemarks']
      .reduce((acc, key) => {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          acc[key] = item[key]
        }
        return acc
      }, {} as Record<string, any>)
  }))
}
