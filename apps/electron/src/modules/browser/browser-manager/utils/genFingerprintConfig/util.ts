import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { API } from '/@/api'
import { appConfig } from '/@/constants'
import { store } from '/@/modules/store'
import { safeParseJSON } from '/@/utils'

let language: any[]

export function getCityCode(key: string) {
  language ||= safeParseJSON(readFileSync(join(appConfig.currentWebDir, 'electron', 'language.json'), 'utf-8'))
  return language.find(item => item.key === key)?.code
}

/** 获取浏览器用户数据目录路径 */
export function getUserDataDirPath(dirId: string) {
  return join(store.browserCacheRootDir, dirId)
}

/** 转换数字, 如果转换后为 NaN, 则返回 null */
export function toNumber(num: string | number, defaultValue: number | null = null) {
  const number = Number(num)
  return Number.isNaN(number) ? defaultValue : number
}

const key = '402ead7d23b43b6d1e0528d4f99c59bd'
const nonce = '3a105229aa31'

export function encryptFingerprintConfig(data) {
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce)
  const encryptedValue = Buffer.concat([
    cipher.update(data),
    cipher.final(),
    cipher.getAuthTag(),
  ])
  return encryptedValue.toString('base64')
}

/** 获取远程配置 */
export const getRemoteConfig = (() => {
  let lastTime = 0
  let config: Record<string, any> = {}
  return () => {
    try {
      const currentTime = Date.now()
      if (currentTime - lastTime > 1000 * 60 * 5) {
        const configFile = readFileSync(join(appConfig.currentWebDir, 'config.json'))
        config = JSON.parse(configFile.toString())
        lastTime = currentTime
      }
      return config
    }
    catch (error) {
      console.error(error)
      return config
    }
  }
})()

const ECOMMERCE_DIRECT_WHITELIST_TTL_MS = 1000 * 60 * 5

let ecommerceDirectWhiteListCache: { data: string[], fetchedAt: number } | null = null
/** 缓存未命中时并发合并：只发起一轮请求，其余调用共享同一 Promise */
let ecommerceDirectWhiteListInflight: Promise<string[]> | null = null

/** 获取电商直连白名单列表（内存缓存 5 分钟；并发 inflight 合并；失败自动重试 1 次；失败则沿用上次成功缓存） */
export async function getEcommerceDirectWhiteList(): Promise<string[]> {
  const now = Date.now()
  if (
    ecommerceDirectWhiteListCache
    && now - ecommerceDirectWhiteListCache.fetchedAt < ECOMMERCE_DIRECT_WHITELIST_TTL_MS
  ) {
    return ecommerceDirectWhiteListCache.data
  }

  if (ecommerceDirectWhiteListInflight) {
    return ecommerceDirectWhiteListInflight
  }

  ecommerceDirectWhiteListInflight = (async () => {
    try {
      let lastCode: number | undefined
      let lastData: unknown
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const { code, data } = await API.base.getEcommerceWhitelistDomainsList()
          if (code === 0 && data) {
            ecommerceDirectWhiteListCache = { data, fetchedAt: Date.now() }
            return data
          }
          lastCode = code
          lastData = data
        }
        catch (err) {
          console.error(
            attempt === 0 ? 'getEcommerceDirectWhiteList request failed, retrying' : 'getEcommerceDirectWhiteList request failed',
            err,
          )
        }
      }
      console.error('getEcommerceDirectWhiteList error (after retry)', lastCode, lastData)
      return ecommerceDirectWhiteListCache?.data ?? []
    }
    finally {
      ecommerceDirectWhiteListInflight = null
    }
  })()

  return ecommerceDirectWhiteListInflight
}
