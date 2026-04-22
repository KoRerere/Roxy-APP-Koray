import { createI18n } from 'vue-i18n'
import { messages } from '~/locale'
import { get } from '~/utils/localstorage'

const fallbackLocale = 'en-us'
const supportedLangs = Object.keys(messages)

function normalizeLocale(locale?: string | null): string {
  return locale?.trim().toLowerCase().replace(/_/g, '-') ?? ''
}

function resolveSupportedLocale(locale?: string | null): string | null {
  const normalizedLocale = normalizeLocale(locale)
  if (!normalizedLocale) {
    return null
  }

  if (supportedLangs.includes(normalizedLocale)) {
    return normalizedLocale
  }

  const baseLang = normalizedLocale.split('-')[0]
  return supportedLangs.find(lang => lang === baseLang || lang.startsWith(`${baseLang}-`)) ?? null
}

/**
 * 地址栏参数应优先于本地缓存和浏览器语言，便于业务侧通过直连链接强制指定文案语言。
 */
function getLocaleFromSearchParams(): string | null {
  return resolveSupportedLocale(new URLSearchParams(window.location.search).get('language'))
}

function detectBrowserLanguage(): string {
  return resolveSupportedLocale(navigator.language) ?? fallbackLocale
}

function resolveInitialLocale(): string {
  return getLocaleFromSearchParams()
    ?? resolveSupportedLocale(get<string>('lang', ''))
    ?? detectBrowserLanguage()
}

export const i18n = createI18n({
  legacy: false,
  locale: resolveInitialLocale(),
  fallbackLocale,
  messages,
})

export function t(key: string, params?: Record<string, unknown>) {
  return i18n.global.t(key, params ?? {}) as string
}

export function te(key: string) {
  return i18n.global.te(key)
}
