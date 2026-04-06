/** 是否处于开发环境 */
export const isDev = import.meta.env.DEV
/** 是否处于生产环境 */
export const isProd = import.meta.env.PROD
/** 是否是 Windows 系统 */
export const isWindows = navigator.platform.includes('Win')
/** 是否是 MacOS 系统 */
export const isMacOS = (() => {
  if (navigator.userAgentData?.platform) {
    const uaData = navigator.userAgentData
    return /mac\s?os/i.test(uaData.platform || '')
  }
  return /Macintosh|Mac OS X/.test(navigator.userAgent)
})()
/** 是否是 Linux 系统 */
export const isLinux = navigator.platform.includes('Linux') && !isMacOS
/** 是否为主窗口 */
/* eslint-disable antfu/no-top-level-await */
export const isMainWindow = await globalThis.electronAPI?.send('app:isMainWindow') ?? true

console.log('isDev', isDev)
console.log('isProd', isProd)
console.log('isMainWindow', isMainWindow)

let pageLoadingTimer: any

export function showPageLoading() {
  document.querySelector<HTMLDivElement>('#page-loading')?.style.setProperty('display', 'flex')
  clearTimeout(pageLoadingTimer)
  // 如果 30s 内没有加载完成，则跳转到 500 页面
  pageLoadingTimer = setTimeout(async () => {
    console.log('Redirecting to 500 page')
    const { default: router } = await import('/@/router')
    router.push({ name: '500' })
    hidePageLoading()
  }, 1000 * 60)
}

if (import.meta.hot) {
  import.meta.hot.accept('/@/router', (newFoo) => {
    console.log('newFoo', newFoo)
  })
}

export function hidePageLoading() {
  document.querySelector<HTMLDivElement>('#page-loading')?.style.setProperty('display', 'none')
  clearTimeout(pageLoadingTimer)
}

if (isMainWindow) {
  showPageLoading()
}
else {
  hidePageLoading()
}

export function isMobile() {
  const ua = navigator.userAgent || ''
  const isMobileUA = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)

  const isSmallScreen = window.matchMedia('(max-width: 768px)').matches

  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  return isMobileUA || (isSmallScreen && isTouch)
}

export async function getCookie(name: string) {
  if (globalThis.cookieStore) {
    const cookie = await cookieStore.get(name)
    return cookie?.value
  }

  const match = document.cookie.match(
    new RegExp(`(^| )${name}=([^;]+)`),
  )
  return match ? decodeURIComponent(match[2]) : null
}
