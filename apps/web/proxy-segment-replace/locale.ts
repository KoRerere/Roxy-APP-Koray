const LOCALE_QUERY = 'locale'
export const LOCALE_QUERY_KEY = LOCALE_QUERY
const PINIA_LOCALE_STORAGE_KEY = 'locale'

/** 落地页支持的语言（与链接参数 locale 取值一致） */
export const SUPPORTED_PAGE_LOCALES = ['zh-CN', 'en', 'ru'] as const

export type PageLocale = typeof SUPPORTED_PAGE_LOCALES[number]

const DEFAULT_PAGE_LOCALE: PageLocale = 'zh-CN'

/** 校验并规范化 URL / 存储中的 locale */
export function normalizePageLocale(raw?: string | null): PageLocale | null {
  if (!raw)
    return null

  const value = raw.trim()
  if (SUPPORTED_PAGE_LOCALES.includes(value as PageLocale))
    return value as PageLocale

  if (value === 'en-US' || value.startsWith('en'))
    return 'en'

  return null
}

/** 与主应用 locale store 持久化结构对齐 */
function getLocaleFromLocalStorage(): PageLocale | null {
  try {
    const raw = localStorage.getItem(PINIA_LOCALE_STORAGE_KEY)
    if (!raw)
      return null

    const data = JSON.parse(raw) as { currentLocale?: string }
    return normalizePageLocale(data.currentLocale)
  }
  catch (err) {
    console.error('[ProxySegmentReplace] read locale from localStorage failed', err)
    return null
  }
}

/** 持久化语言偏好，与主应用 locale store 结构一致 */
export function persistPageLocale(locale: PageLocale) {
  try {
    const raw = localStorage.getItem(PINIA_LOCALE_STORAGE_KEY)
    const data = raw ? JSON.parse(raw) : {}
    data.currentLocale = locale
    localStorage.setItem(PINIA_LOCALE_STORAGE_KEY, JSON.stringify(data))
  }
  catch (err) {
    console.error('[ProxySegmentReplace] persist locale to localStorage failed', err)
  }
}

/** URL 落地后移除 locale，避免分享链接携带语言参数 */
function stripLocaleFromUrl() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has(LOCALE_QUERY))
    return

  url.searchParams.delete(LOCALE_QUERY)
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

/**
 * 解析落地页语言：优先 URL locale 并持久化，其次 localStorage，默认 zh-CN。
 */
export function initPageLocale(): PageLocale {
  const queryLocale = normalizePageLocale(
    new URLSearchParams(window.location.search).get(LOCALE_QUERY),
  )

  if (queryLocale) {
    persistPageLocale(queryLocale)
    stripLocaleFromUrl()
    return queryLocale
  }

  return getLocaleFromLocalStorage() ?? DEFAULT_PAGE_LOCALE
}

/** 当前页语言（init 后不变） */
export const pageLocale = initPageLocale()

/** 页头语言标签（对齐设计稿短码） */
export const PAGE_LOCALE_LABELS: Record<PageLocale, string> = {
  'zh-CN': '中文',
  'en': 'EN',
  'ru': 'RU',
}
