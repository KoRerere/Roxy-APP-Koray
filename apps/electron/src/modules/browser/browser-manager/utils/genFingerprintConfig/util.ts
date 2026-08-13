import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { API } from '/@/api'
import { appConfig } from '/@/constants'
import { store } from '/@/modules/store'
import { safeParseJSON } from '/@/utils'
import { isEcommerceWorkspace } from '/@/utils/proxyEntityLabels'

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

/** 传给内核的自动填充账号密码站点 */
interface AutofillWebSite {
  /** 业务平台 origin（协议+主机+端口+尾斜杠；Google 密码管理器不能带路径/query） */
  url: string
  /** 平台账号 */
  username: string
  /** 平台密码 */
  password: string
}

/** 平台账号列表项（仅取生成 autofill 所需字段） */
interface WindowPlatformItem {
  platformUrl?: string
  platformUserName?: string
  platformPassword?: string
  /** 账号平台元信息；redirectUrls 为同账号可登录的其它入口 */
  _accountPlatform?: {
    redirectUrls?: string[]
  }
}

/** 用 WHATWG URL 解析；缺协议时补 https，否则 `new URL` 无法解析裸主机 */
function parseAutofillUrl(url: string): URL | null {
  const trimmed = url.trim()
  if (!trimmed) {
    return null
  }
  try {
    return new URL(trimmed)
  }
  catch {
    try {
      return new URL(`https://${trimmed}`)
    }
    catch {
      return null
    }
  }
}

/** origin 本身不含尾斜杠；密码管理器按站点根路径匹配，需要补成 `https://host/` */
function withTrailingSlash(origin: string): string {
  return origin.endsWith('/') ? origin : `${origin}/`
}

/** 去掉路径、query、hash，只保留带尾斜杠的 origin；解析失败则原样返回（去空白后） */
function toAutofillOrigin(url: string): string {
  const trimmed = url.trim()
  const origin = parseAutofillUrl(trimmed)?.origin
  return origin ? withTrailingSlash(origin) : trimmed
}

/**
 * 匹配主机名末尾的国家代码后缀：两位字母 ccTLD，以及 .com.br / .co.uk / .co.jp 这类挂在 ccTLD 下的二级后缀。
 * 二级部分整体替换，避免 mercadolivre.com.br 被换成 mercadolivre.com.com。
 */
const COUNTRY_SUFFIX_RE = /(?:\.(?:com|co|net|org|gov|edu|ac|or|ne|in))?\.[a-z]{2}$/i

/**
 * 生成自动填充站点列表。
 *
 * url 只保留 origin：内核会写入 Google 密码管理器，带路径/query 无法按站点匹配填充。
 * 同一账号除 platformUrl 外，还会展开 `_accountPlatform.redirectUrls`（如 TikTok Shop 多登录入口），共用同一套用户名密码。
 * 电商模式下，同一套账号通常在国际站（.com）也可登录，但用户往往只配置了本地站（如 amazon.de、mercadolivre.com.br），
 * 因此为国家代码后缀的地址补一条 .com 版本紧跟其后。补全仅作兜底：原列表中已存在同主机名的条目时不再补，
 * 以用户自己的配置为准。
 */
export function genAutofillWebSiteMult(windowPlatformList: WindowPlatformItem[] = []): AutofillWebSite[] {
  const list = windowPlatformList.flatMap((item) => {
    const username = item.platformUserName ?? ''
    const password = item.platformPassword ?? ''
    // platformUrl 始终占一条；redirectUrls 去重后追加，避免与主地址重复写入
    const urls = [item.platformUrl ?? '', ...(item._accountPlatform?.redirectUrls ?? [])]
    const seen = new Set<string>()
    return urls
      .map(url => toAutofillOrigin(url))
      .filter((url) => {
        if (!url || seen.has(url)) {
          return false
        }
        seen.add(url)
        return true
      })
      .map(url => ({ url, username, password }))
  })

  if (!isEcommerceWorkspace()) {
    return list
  }

  const existedHosts = new Set(
    list
      .map(item => parseAutofillUrl(item.url)?.hostname.toLowerCase())
      .filter(Boolean) as string[],
  )

  const result: AutofillWebSite[] = []
  for (const item of list) {
    result.push(item)

    const parsed = parseAutofillUrl(item.url)
    if (!parsed || !COUNTRY_SUFFIX_RE.test(parsed.hostname)) {
      continue
    }

    const comHost = parsed.hostname.replace(COUNTRY_SUFFIX_RE, '.com')
    if (existedHosts.has(comHost.toLowerCase())) {
      continue
    }
    existedHosts.add(comHost.toLowerCase())

    // 只改主机名，协议/端口跟原 origin 走，避免再手拼 URL
    const comUrl = new URL(parsed.origin)
    comUrl.hostname = comHost
    result.push({
      ...item,
      url: withTrailingSlash(comUrl.origin),
    })
  }

  return result
}

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
