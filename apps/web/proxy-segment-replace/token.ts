import { OFFICIAL_SITE_REDIRECT } from '/@/constants/search-params-key'

const TOKEN_QUERY = 'token'
const LOGIN_PATH = '/login'
/** 落地页路径，跨域/同域切换语言时跳转目标 */
export const LANDING_PAGE_PATH = '/proxy-segment-replace.html'
export const TOKEN_QUERY_KEY = TOKEN_QUERY
const PINIA_USER_STORAGE_KEY = 'user'

/** 从 document.cookie 同步读取 token，避免 init 阶段依赖异步 API */
function readCookieSync(name: string) {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`))
  return match ? decodeURIComponent(match[2]) : ''
}

/** 读取 Pinia 持久化的 user.token，与主应用登录态互通 */
function getTokenFromLocalStorage() {
  try {
    const raw = localStorage.getItem(PINIA_USER_STORAGE_KEY)
    if (!raw)
      return ''

    const data = JSON.parse(raw) as { token?: string }
    return data.token?.trim() ?? ''
  }
  catch (err) {
    console.error('[ProxySegmentReplace] read token from localStorage failed', err)
    return ''
  }
}

/** 写入 cookie 与 localStorage，便于落地页刷新及回到主应用仍保持登录 */
function persistToken(token: string) {
  const domain = location.hostname.split('.').slice(-2).join('.')
  const encoded = encodeURIComponent(token)

  if (domain && !location.hostname.includes('localhost'))
    document.cookie = `roxy_token=${encoded}; domain=${domain}; path=/`
  else
    document.cookie = `roxy_token=${encoded}; path=/`

  try {
    const raw = localStorage.getItem(PINIA_USER_STORAGE_KEY)
    const data = raw ? JSON.parse(raw) : {}
    data.token = token
    localStorage.setItem(PINIA_USER_STORAGE_KEY, JSON.stringify(data))
  }
  catch (err) {
    console.error('[ProxySegmentReplace] persist token to localStorage failed', err)
  }
}

/** URL 携带 token 时落地后立即移除，避免泄露在地址栏或分享链接中 */
function stripTokenFromUrl() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has(TOKEN_QUERY))
    return

  url.searchParams.delete(TOKEN_QUERY)
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

function redirectToLogin() {
  const redirect = encodeURIComponent(LANDING_PAGE_PATH)
  window.location.replace(`${LOGIN_PATH}?${OFFICIAL_SITE_REDIRECT}=${redirect}`)
}

/**
 * 解析落地页登录态：优先 URL token 并持久化，其次 cookie / localStorage；
 * 均无则跳转登录页。
 */
export function initAuthToken() {
  const queryToken = new URLSearchParams(window.location.search).get(TOKEN_QUERY)?.trim()

  if (queryToken) {
    persistToken(queryToken)
    stripTokenFromUrl()
    return queryToken
  }

  const cookieToken = readCookieSync('roxy_token').trim()
  if (cookieToken)
    return cookieToken

  const storageToken = getTokenFromLocalStorage()
  if (storageToken)
    return storageToken

  redirectToLogin()
  return ''
}

/** 当前页可用的 auth token（init 后不变） */
export const authToken = initAuthToken()
