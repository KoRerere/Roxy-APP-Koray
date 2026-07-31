import { getLocaleAppOrigin } from '/@/stores/locale'
import { clearDictCache } from '/@/utils/'
import { API } from './api'
import { LANDING_PAGE_PATH, TOKEN_QUERY_KEY, authToken } from './token'
import { LOCALE_QUERY_KEY, pageLocale, persistPageLocale, type PageLocale } from './locale'

/** 从 cookie 读取 token */
function readRoxyTokenFromCookie() {
  const match = document.cookie.match(/(?:^| )roxy_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

/** 落地页跳转 URL：仅携带 token + locale，与邮件/通知链接格式一致 */
export function buildLandingPageHref(base: string, token: string, locale: PageLocale) {
  const url = new URL(LANDING_PAGE_PATH, base.endsWith('/') ? base : `${base}/`)
  url.searchParams.set(TOKEN_QUERY_KEY, token)
  url.searchParams.set(LOCALE_QUERY_KEY, locale)
  return url.href
}

/**
 * 落地页切换语言：同步后端偏好后，跳转到带 token + locale 的落地页 URL。
 */
export async function switchPageLocale(locale: PageLocale) {
  if (pageLocale === locale)
    return

  try {
    await API.base.userSetUserConfigCreate({ language: locale })
  }
  catch (err) {
    console.error('[ProxySegmentReplace] save user language failed', err)
  }
  finally {
    clearDictCache()
    persistPageLocale(locale)
    globalThis.electronAPI.send('app:saveSoftConfig', { language: locale } as never)
  }

  if (globalThis.isElectron) {
    location.reload()
    return
  }

  const token = readRoxyTokenFromCookie() || authToken
  if (!token) {
    location.reload()
    return
  }

  const targetBase = getLocaleAppOrigin(locale)
  location.replace(buildLandingPageHref(`${targetBase}/`, token, locale))
}
