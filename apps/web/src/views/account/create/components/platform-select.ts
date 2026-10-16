/** 平台下拉选项；图标按明暗主题分开存放 */
export interface PlatformSelectOption {
  value?: string
  label?: string
  image?: string
  darkImage?: string
}

/** 图标下拉写回账号时使用的明暗图标地址 */
export interface PlatformIconValue {
  platformIcon: string
  platformIconDark: string
  /** 用户改了网址或图标。初始化对齐不算用户修改，避免把未编辑的关联账号解绑 */
  fromUser: boolean
}

/** 国家码顶级域下常见的二级公共后缀，例如 co.uk、com.cn */
const COMPOUND_PUBLIC_SUFFIX_LABELS = new Set(['ac', 'co', 'com', 'edu', 'go', 'gov', 'ne', 'net', 'or', 'org'])

/**
 * 把平台列表转成下拉选项。
 * value 用平台网址，方便和图标下拉互相查找。
 */
export function toPlatformSelectOptions(rows: Array<{ platformIcon?: string, platformIconDark?: string, platformUrl?: string | null }> | undefined): PlatformSelectOption[] {
  return (rows ?? []).map(item => ({
    image: item.platformIcon,
    darkImage: item.platformIconDark,
    label: item.platformUrl ?? '',
    value: item.platformUrl ?? '',
  }))
}

/** 图标下拉只保留有图标的平台，避免一排空白占位 */
export function toIconOptions(options: PlatformSelectOption[] | undefined): PlatformSelectOption[] {
  return (options ?? []).filter(item => item.image || item.darkImage)
}

/**
 * 取出平台网址的 hostname。
 * 自由输入时可能还没有协议，补上后再解析；解析失败就无法对齐图标。
 */
export function getPlatformHostname(platformUrl: string): string {
  const trimmed = platformUrl.trim()
  if (!trimmed) {
    return ''
  }

  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    return new URL(withProtocol).hostname.toLowerCase().replace(/\.$/, '')
  }
  catch {
    return ''
  }
}

/**
 * 取主域名（eTLD+1），把不同子域名归到同一平台。
 * 纯 IP 和无法解析的地址不参与匹配，避免误用其他平台图标。
 */
export function getRegistrableDomain(platformUrl: string): string {
  const hostname = getPlatformHostname(platformUrl)
  if (!hostname || hostname.includes(':') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
    return ''
  }

  const labels = hostname.split('.').filter(Boolean)
  if (labels.length < 2) {
    return ''
  }

  const tld = labels[labels.length - 1]
  const secondLevel = labels[labels.length - 2]
  if (labels.length >= 3 && tld.length === 2 && COMPOUND_PUBLIC_SUFFIX_LABELS.has(secondLevel)) {
    return labels.slice(-3).join('.')
  }

  return labels.slice(-2).join('.')
}

/**
 * 先精确匹配网址，再按主机名，最后按主域名取第一个支持平台。
 * 选项里没有 one.google.com 时，沿用 account.google.com 这类同主域名项的图标。
 */
export function findPlatformOption(value: unknown, options: PlatformSelectOption[] | undefined): PlatformSelectOption | undefined {
  if (typeof value !== 'string' || !value.trim() || !options?.length) {
    return undefined
  }

  const exact = options.find(item => item.value === value)
  if (exact) {
    return exact
  }

  const hostname = getPlatformHostname(value)
  if (hostname) {
    const sameHost = options.find(item => item.value && getPlatformHostname(item.value) === hostname)
    if (sameHost) {
      return sameHost
    }
  }

  const domain = getRegistrableDomain(value)
  if (!domain) {
    return undefined
  }

  return options.find(item => item.value && getRegistrableDomain(item.value) === domain)
}

/**
 * 用已保存的图标地址找回选项。
 * 图标可以和当前网址不是同一个平台，回填时要先还原用户保存的那一个。
 */
export function findSavedIconOption(icon: string | undefined, iconDark: string | undefined, options: PlatformSelectOption[] | undefined): PlatformSelectOption | undefined {
  if (!icon && !iconDark) {
    return undefined
  }
  return toIconOptions(options).find(item =>
    (icon && item.image === icon) || (iconDark && item.darkImage === iconDark),
  )
}

/**
 * 网址匹配到的平台图标选项值。
 * 没有图标的平台不占用图标下拉。
 */
export function matchPlatformIconKey(url: unknown, options: PlatformSelectOption[] | undefined): string {
  const platform = findPlatformOption(url, options)
  if (!platform?.value || !(platform.image || platform.darkImage)) {
    return ''
  }
  return platform.value
}

/**
 * 决定图标下拉当前选中的选项值。
 * 已有图标优先，没有时才按网址预填。
 */
export function resolveIconKey(url: unknown, icon: string | undefined, iconDark: string | undefined, options: PlatformSelectOption[] | undefined): string {
  return findSavedIconOption(icon, iconDark, options)?.value || matchPlatformIconKey(url, options)
}

/** 把图标下拉的选中值还原成提交用的明暗图标地址 */
export function resolvePlatformIcons(iconKey: unknown, options: PlatformSelectOption[] | undefined, fromUser: boolean): PlatformIconValue {
  const icon = (options ?? []).find(item => item.value === iconKey)
  return {
    platformIcon: icon?.image || '',
    platformIconDark: icon?.darkImage || '',
    fromUser,
  }
}
