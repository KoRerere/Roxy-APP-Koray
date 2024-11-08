import type { UserGetDictVersionListData, UserGetSystemDictV2CreateData } from '@roxy/backend-api'
import { API } from '/@/api'
import { isEmptyValue } from '/@/utils/basic'

type DictMap = UserGetDictVersionListData['data']
type DictItem = UserGetSystemDictV2CreateData['data'][number]

const EXPIRY_CONFIG = {
  _EXPIRY_TIME: 1000 * 60 * 60 * 4,
  _EXPIRED_VALUE: 0,
  isExpired() {
    const _isExpired = new Date().getTime() > (EXPIRY_CONFIG._EXPIRED_VALUE ?? 0)
    if (_isExpired) {
      EXPIRY_CONFIG._EXPIRED_VALUE = new Date().getTime() + EXPIRY_CONFIG._EXPIRY_TIME
    }
    return _isExpired
  },
}

export async function getDictMap() {
  if (EXPIRY_CONFIG.isExpired()) {
    await getDictVersion()
  }

  const $dict_map = new Proxy(JSON.parse(localStorage.getItem('$dict_map') ?? '{}'), {
    get(target, key) {
      return target[key] || []
    },
  })
  return $dict_map
}

export async function getDictVersion() {
  const { data: newVersion } = await API.base.userGetDictVersionList()
  const oldVersion = JSON.parse(localStorage.getItem('$dict_version') || 'null')
  const oldDict = JSON.parse(localStorage.getItem('$dict_map') || 'null')

  const needUpdateDict = isEmptyValue(oldVersion) || isEmptyValue(oldDict)
    ? newVersion
    : Object.fromEntries(Object.entries(newVersion).filter(([key, value]) => oldVersion[key as keyof DictMap] !== value))

  if (!isEmptyValue(needUpdateDict)) {
    localStorage.setItem('$dict_version', JSON.stringify(newVersion))
    await fetchDictData(Object.keys(needUpdateDict))
  }
}

async function fetchDictData(type: any) {
  const { data } = await API.base.userGetSystemDictV2Create({ type })
  const dictMap = data.reduce((map, item) => {
    const type = item.type.includes('osVersion')
      ? item.type.toLocaleLowerCase().replace('-', '_')
      : item.type;

    (map[type] || (map[type] = [])).push(item)
    return map
  }, {} as Record<string, DictItem[]>)

  const oldDict = JSON.parse(localStorage.getItem('$dict_map') || '{}')
  localStorage.setItem('$dict_map', JSON.stringify(Object.assign(oldDict, dictMap)))
}
