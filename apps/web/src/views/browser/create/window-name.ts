import { API } from '/@/api'
import { ProxyCheckStatus } from '/@/enums'
import { findPlatformOption } from '/@/views/account/create/components/platform-select'
import type { PlatformSelectOption } from '/@/views/account/create/components/platform-select'
import { fetchDefaultWindowName } from './utils'

/** 平台库选项；platformAbbr 是窗口名称前缀用的缩写，例如 FB */
export interface PlatformAbbrOption extends PlatformSelectOption {
  platformAbbr?: string
}

/** 生成建议名时用到的账号与代理草稿 */
export interface SuggestedWindowNameSource {
  accounts?: Array<{ platformUrl?: string, platformAbbr?: string }>
  proxyList?: unknown
}

/** 平台库行；platformAbbr 尚未进入生成类型，按接口实际字段读取 */
interface PlatformCatalogRow {
  platformUrl?: string | null
  platformAbbr?: string
}

/**
 * 把平台库行收成可按网址匹配的缩写表。
 * 没有缩写的平台不参与前缀，避免匹配成功却拼出空段。
 */
export function toPlatformAbbrOptions(rows: PlatformCatalogRow[] | undefined): PlatformAbbrOption[] {
  return (rows ?? []).flatMap((row) => {
    const url = row.platformUrl ?? ''
    const platformAbbr = String(row.platformAbbr ?? '').trim()
    if (!url || !platformAbbr) {
      return []
    }
    return [{ label: url, value: url, platformAbbr }]
  })
}

/** 拉取官方平台库。失败时退回无缩写，名称仍保留日期序号 */
export async function fetchPlatformAbbrCatalog(): Promise<PlatformAbbrOption[]> {
  try {
    const { code, data } = await API.platform.userGetPlatformInfoList({})
    if (code !== 0) {
      return []
    }
    return toPlatformAbbrOptions((data?.rows ?? []) as PlatformCatalogRow[])
  }
  catch (error) {
    console.error('[fetchPlatformAbbrCatalog] failed to load platform catalog', error)
    return []
  }
}

/**
 * 单条是否在使用代理 IP。
 * 只参与国家码前缀；平台缩写与代理无关。自定义 / 已有 / API 都算使用代理。
 */
function isProxyEntry(item: Record<string, any> | undefined): boolean {
  if (!item) {
    return false
  }
  const method = String(item.proxyMethod || '').toLowerCase()
  const category = String(item.proxyCategory || item.protocol || '').toLowerCase()
  if (method === 'noproxy' || category === 'noproxy') {
    return false
  }
  return method === 'custom' || method === 'choose' || method === 'api' || Boolean(item.host) || Boolean(item.id)
}

/**
 * 按账号顺序取第一个平台缩写。
 * 账号自身带 platformAbbr 时直接用；手输网址则按主机名 / 主域名对齐平台库。
 */
export function resolvePlatformAbbr(accounts: SuggestedWindowNameSource['accounts'], catalog: PlatformAbbrOption[]): string {
  for (const account of accounts ?? []) {
    const direct = String(account?.platformAbbr ?? '').trim()
    if (direct) {
      return direct
    }
    const matched = findPlatformOption(account?.platformUrl, catalog) as PlatformAbbrOption | undefined
    const abbr = matched?.platformAbbr?.trim()
    if (abbr) {
      return abbr
    }
  }
  return ''
}

/**
 * 单条代理上检测成功的国家码，大写。
 * 本次检测失败不展示；未在本次检测时，沿用已有出口 IP 上的国家码。
 */
function readDetectedCountry(item: Record<string, any> | undefined): string {
  if (!isProxyEntry(item) || !item) {
    return ''
  }
  if (item.checkStatus === ProxyCheckStatus.failure) {
    return ''
  }
  const country = String(item.lastCountry ?? '').trim()
  const ip = String(item.lastIp ?? '').trim()
  const detected = item.checkStatus === ProxyCheckStatus.success || Boolean(ip)
  if (!country || !detected) {
    return ''
  }
  return country.toUpperCase()
}

/** 列表中第一条检测成功的 IP 国家码 */
export function resolveDetectedProxyCountry(proxyList: unknown): string {
  if (!Array.isArray(proxyList)) {
    return ''
  }
  for (const item of proxyList) {
    const country = readDetectedCountry(item)
    if (country) {
      return country
    }
  }
  return ''
}

/**
 * 在 `yyMMdd-序号` 前拼接平台缩写与国家码。
 * 缺段跳过，避免出现 `FB--261013-3`。
 */
export function composeSuggestedWindowName(serial: string, platformAbbr?: string, countryCode?: string): string {
  const prefix = [platformAbbr?.trim(), countryCode?.trim().toUpperCase()].filter(Boolean)
  return prefix.length ? `${prefix.join('-')}-${serial}` : serial
}

/**
 * 用已取到的日期序号和平台库拼出当前表单的建议名。
 * 平台缩写和代理国家码互不影响：有缩写就加平台段，使用代理且有国家才加国家段。
 */
export function buildSuggestedWindowName(serial: string, source: SuggestedWindowNameSource, catalog: PlatformAbbrOption[]): string {
  const platformAbbr = resolvePlatformAbbr(source.accounts, catalog)
  const countryCode = resolveDetectedProxyCountry(source.proxyList)
  return composeSuggestedWindowName(serial, platformAbbr, countryCode)
}

/**
 * 快速创建等没有实时 placeholder 的提交路径。
 * 序号接口失败时返回 undefined，调用方保持空名称。
 */
export async function resolveSuggestedWindowName(source: SuggestedWindowNameSource): Promise<string | undefined> {
  const [serial, catalog] = await Promise.all([
    fetchDefaultWindowName(),
    fetchPlatformAbbrCatalog(),
  ])
  if (!serial) {
    return undefined
  }
  return buildSuggestedWindowName(serial, source, catalog)
}

/**
 * 读取已写到输入项上的建议名。
 * 与 placeholder 同步，但不能回退到「未命名窗口」提示文案。
 */
export function readSuggestedWindowName(input: { suggestedWindowName?: string } | undefined): string {
  return String(input?.suggestedWindowName ?? '').trim()
}
