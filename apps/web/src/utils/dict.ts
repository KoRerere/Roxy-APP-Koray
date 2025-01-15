import type { UserGetDictVersionListData, UserGetSystemDictV2CreateData } from '@roxy/backend-api'
import { API } from '/@/api'
import { isEmptyValue } from '/@/utils/basic'

type DictMap = UserGetDictVersionListData['data']
type DictItem = UserGetSystemDictV2CreateData['data'][number]

const DICT_CONFIG = {
  EXPIRY_TIME: 1000 * 60 * 60 * 4,
  EXPIRED_VALUE: 0,
  isExpired() {
    const _isExpired = new Date().getTime() > DICT_CONFIG.EXPIRED_VALUE
    if (_isExpired) {
      DICT_CONFIG.EXPIRED_VALUE = new Date().getTime() + DICT_CONFIG.EXPIRY_TIME
    }
    // return _isExpired || DICT_CONFIG.isDictLose()
    return DICT_CONFIG.isDictLose()
  },
  isDictLose() {
    const version = JSON.parse(localStorage.getItem('$dict_version') || 'null')
    const dict = JSON.parse(localStorage.getItem('$dict_map') || 'null')
    return isEmptyValue(version) || isEmptyValue(dict)
  },
}

export function clearDictCache() {
  DICT_CONFIG.EXPIRED_VALUE = 0
  localStorage.removeItem('$dict_version')
  localStorage.removeItem('$dict_map')
  localStorage.removeItem('lastDictVersion')
}

export async function getDictMap() {
  // if (DICT_CONFIG.isExpired()) {
  // await getDictVersion()
  // }

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

  const needUpdateDict = DICT_CONFIG.isDictLose()
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
