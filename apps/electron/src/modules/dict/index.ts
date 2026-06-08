import type { UserGetDictVersionListData, UserGetSystemDictV2CreateData } from '@roxy/backend-api'
import { debounce } from 'es-toolkit'
import { isEmpty } from 'es-toolkit/compat'
import { readFile, rename, writeFile } from 'node:fs/promises'
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
  /** IPV4 检测域名列表 */
  'ip-check-domains': string[]
  /** IPV4 检测渠道字典列表 */
  'checkChannel': Record<string, string>
  /** IPV6 检测域名列表 */
  'ipv6-check-domains': string[]
  /** IPV6 检测渠道字典列表 */
  'ipv6-query-channels': Record<string, string>
  /** 网络节点字典列表，值格式：app.roxybrowser.com;us.gate.roxybrowser.net;us.api.roxybrowser.net */
  'network_node': { site: string, gate: string, api: string }[]
}

/** 主进程用到的字典，后续根据版本只更新这些字典 */
const dictKeys = [
  'ip-check-domains',
  'checkChannel',
  'ipv6-check-domains',
  'ipv6-query-channels',
  'network_node',
] as const

export type DictKey = (typeof dictKeys)[number]

const cacheFilePath = join(appConfig.sessionDir, 'dict-cache.json')

const _dictStore: DictStore = {
  'versions': {},
  'latestVersion': 0,
  'ip-check-domains': [],
  'checkChannel': {},
  'ipv6-check-domains': [],
  'ipv6-query-channels': {},
  'network_node': [
    { site: 'app.roxybrowser.cn', gate: 'hz.gate.roxybrowser.cn', api: 'hz.api.roxybrowser.cn' },
    { site: 'app.roxybrowser.com', gate: 'sg.gate.roxybrowser.net', api: 'sg.api.roxybrowser.net' },
    { site: 'app.roxybrowser.com', gate: 'gate.roxybrowser.net', api: 'api.roxybrowser.net' },
    { site: 'app.roxybrowser.com', gate: 'us.gate.roxybrowser.net', api: 'us.api.roxybrowser.net' },
  ],
}

async function forceSaveDictCache() {
  try {
    const encryptedData = encryptData(JSON.stringify(_dictStore))
    // 原子性写入：先写入临时文件，再 rename 替换，避免进程异常退出导致目标文件被部分写入而损坏
    const tmpFile = `${cacheFilePath}.tmp`
    await writeFile(tmpFile, encryptedData, 'utf-8')
    await rename(tmpFile, cacheFilePath)
  }
  catch (error) {
    console.error('saveDictCache error:', error)
  }
}

export const autoSaveDictCache = debounce(forceSaveDictCache, 60)

/** network_node 字典更新后的回调列表 */
const networkNodeListeners: Array<() => void> = []

/**
 * 注册 network_node 字典更新监听器
 * 当字典数据从服务端拉取完成并写入后触发
 */
export function onNetworkNodeUpdated(cb: () => void) {
  networkNodeListeners.push(cb)
}

export const dictStore = new Proxy(_dictStore, {
  set(target, prop: keyof DictStore, value) {
    Reflect.set(target, prop, value)
    autoSaveDictCache()
    // 当 network_node 写入时，通知所有监听器
    if (prop === 'network_node') {
      networkNodeListeners.forEach(cb => cb())
    }
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
  // await initDictCachePromise
  // if (isEmpty(dictStore.versions)) {
  await getDictVersions()
  // }
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
    if (dictKeys.includes(key as DictKey)) {
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
  const type = keys.filter(key => dictKeys.includes(key))
  if (!type.length)
    return

  const { code, data } = await API.base.userGetSystemDictV2Create({ type })
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
      if (key === 'checkChannel' || key === 'ipv6-query-channels') {
        dictStore[key] = items.reduce((map, item) => {
          const hostname = new URL(item.value).hostname
          map[hostname] = item.label.toLowerCase()
          return map
        }, {})
      }
      else if (key === 'network_node') {
        dictStore[key] = items.map((item) => {
          const [site, gate, api] = item.value.split(';')
          return { site, gate, api }
        })
      }
      else {
        dictStore[key] = items.map(n => n.value)
      }
    }
  }
}
