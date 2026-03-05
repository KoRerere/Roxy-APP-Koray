import type { UserGetDictVersionListData, UserGetSystemDictV2CreateData } from '@roxy/backend-api'
import { debounce } from 'es-toolkit'
import { isEmpty } from 'es-toolkit/compat'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { API } from '/@/api'
import { appConfig } from '/@/constants'
import { decryptData, encryptData, store } from '/@/modules/store'
import { safeParseJSON } from '/@/utils'

interface DictStore {
  /** 所有字典项的版本信息 */
  'versions': Record<string, string>
  /** 最新的字典版本号 */
  'latestVersion': number
  /** IP 检测域名列表 */
  'ip-check-domains': string[]
  /** 检测渠道字典列表 */
  'checkChannel': Record<string, string>
  /** ip2location keys */
  'ip2location-key': string[]
  /** ipv6 检测 */
  'ipv6Check': string[]
}

/** 主进程用到的字典，后续根据版本只更新这些字典 */
const dictKeys = [
  'ip-check-domains',
  'checkChannel',
  'ip2location-key',
  'ipv6Check',
] as const

export type DictKey = (typeof dictKeys)[number]

const cacheFilePath = join(appConfig.sessionDir, 'dict-cache.json')

const _dictStore: DictStore = {
  'versions': {},
  'latestVersion': 0,
  'ip-check-domains': [],
  'checkChannel': {},
  'ip2location-key': [],
  'ipv6Check': [],
}

async function forceSaveDictCache() {
  try {
    const encryptedData = encryptData(JSON.stringify(_dictStore))
    await writeFile(cacheFilePath, encryptedData, 'utf-8')
  }
  catch (error) {
    console.error('saveDictCache error:', error)
  }
}

export const autoSaveDictCache = debounce(forceSaveDictCache, 60)

export const dictStore = new Proxy(_dictStore, {
  set(target, prop: keyof DictStore, value) {
    Reflect.set(target, prop, value)
    autoSaveDictCache()
    return true
  },
})

const initDictCachePromise = (async () => {
  try {
    const content = await readFile(cacheFilePath, 'utf-8')
    // 解密数据
    const cache = safeParseJSON(content, () => {
      const decryptedConfig = decryptData(content)
      return JSON.parse(decryptedConfig)
    })
    if (cache) {
      Object.assign(_dictStore, cache)
    }
  }
  catch (error) {
    // 忽略读取错误，可能是首次启动
  }
})()

export async function initDictCache() {
  await initDictCachePromise
  if (isEmpty(dictStore.versions)) {
    await getDictVersions()
  }
}

/** 获取字典版本 */
export async function getDictVersions() {
  await initDictCachePromise
  const { code, data } = await API.base.userGetDictVersionList()
  if (code === 0) {
    await checkDictUpdate(data)

    updateDictVersions(data)
  }

  return { code, data }
}

/** 更新字典版本 */
function updateDictVersions(remoteVersions: UserGetDictVersionListData['data']) {
  const versions = Object.entries(remoteVersions).reduce((result, [key, value]) => {
    if (dictKeys.includes(key)) {
      result[key] = value
    }
    return result
  }, {} as Record<string, string>)

  // 更新字典版本
  dictStore.versions = versions
}

/** 检查字典是否需要更新 */
async function checkDictUpdate(remoteVersions: UserGetDictVersionListData['data']) {
  // 需要更新的字典 key
  const needUpdateKeys = dictKeys.filter(key => dictStore.versions[key] !== remoteVersions[key])
  if (needUpdateKeys.length > 0) {
    await updateDict(needUpdateKeys)
  }
}

/** 更新字典 */
export async function updateDict(keys: DictKey[]) {
  const { code, data } = await API.base.userGetSystemDictV2Create({
    type: keys.filter(key => dictKeys.includes(key)),
  })
  if (code === 0) {
    const dictMap: Record<string, UserGetSystemDictV2CreateData['data']> = {}
    if (Array.isArray(data)) {
      for (const item of data) {
        if (!dictMap[item.type]) {
          dictMap[item.type] = []
        }
        dictMap[item.type].push(item)
      }
    }

    for (const key of keys) {
      const items = dictMap[key] || []
      if (key === 'checkChannel') {
        dictStore.checkChannel = items.reduce((map, item) => {
          const hostname = new URL(item.value).hostname
          map[hostname] = item.label.toLowerCase()
          return map
        }, {})
      }
      else {
        dictStore[key] = items.map(n => n.value)
        if (key === 'ipv6Check') {
          store.ipv6CheckUrl = dictStore[key].at(0)
        }
      }
    }
  }
}
