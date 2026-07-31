import { compare } from 'compare-versions'
import { ref, watch } from 'vue'

/** 是否处于开发环境 */
export const isDev = import.meta.env.DEV
/** 是否处于生产环境 */
export const isProd = import.meta.env.PROD
/** 是否是 Windows 系统 */
export const isWindows = navigator.platform.includes('Win')
/** 是否是 MacOS 系统 */
export const isMacOS = (() => {
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
  if (uaData?.platform) {
    return /mac\s?os/i.test(uaData.platform)
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

/** 全局 page-loading 可见性（与 show/hidePageLoading 同步，作为唯一状态源） */
export const pageLoadingVisible = ref(isMainWindow)

export function showPageLoading() {
  pageLoadingVisible.value = true
  document.querySelector<HTMLDivElement>('#page-loading')?.style.setProperty('display', 'flex')
  clearTimeout(pageLoadingTimer)
  // 若 60s 内没有加载完成，则跳转到 500 页面（同时会 hidePageLoading）
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
  pageLoadingVisible.value = false
  document.querySelector<HTMLDivElement>('#page-loading')?.style.setProperty('display', 'none')
  clearTimeout(pageLoadingTimer)
}

/** 全局 page-loading 是否仍在展示 */
export function isPageLoadingVisible(): boolean {
  return pageLoadingVisible.value
}

function isPageLoadingVisibleInDom(): boolean {
  const pageLoading = document.querySelector<HTMLElement>('#page-loading')
  return !!pageLoading && getComputedStyle(pageLoading).display !== 'none'
}

const PAGE_LOADING_WAIT_MS = 30_000

/**
 * 等待全局 page-loading 隐藏；已隐藏则立即 resolve。
 * 正常路径由 workspaceStore 调 hidePageLoading；异常路径由 showPageLoading 60s 兜底。
 * 30s 超时：若 DOM 已隐藏则仍 resolve true（纠正 ref 与 DOM 不同步）。
 */
export function whenPageLoadingHidden(
  registerCancel?: (cancel: () => void) => void,
): Promise<boolean> {
  if (!pageLoadingVisible.value && !isPageLoadingVisibleInDom())
    return Promise.resolve(true)

  return new Promise((resolve) => {
    let settled = false
    let stop: () => void
    let timer: ReturnType<typeof setTimeout>

    const finish = (result: boolean) => {
      if (settled)
        return
      settled = true
      stop?.()
      clearTimeout(timer)
      resolve(result)
    }

    stop = watch(pageLoadingVisible, (visible) => {
      if (!visible)
        finish(true)
    }, { immediate: true })

    registerCancel?.(() => finish(false))

    timer = setTimeout(() => {
      if (!isPageLoadingVisibleInDom()) {
        console.warn('[whenPageLoadingHidden] resolved via DOM fallback')
        pageLoadingVisible.value = false
        finish(true)
        return
      }
      console.warn('[whenPageLoadingHidden] timed out')
      finish(false)
    }, PAGE_LOADING_WAIT_MS)
  })
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
    if (cookie?.value)
      return cookie.value
  }

  const match = document.cookie.match(
    new RegExp(`(^| )${name}=([^;]+)`),
  )
  return match ? decodeURIComponent(match[2]) : null
}

export function removeCookie(name: string, path = '/', domain?: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path};${domain ? ` domain=${domain};` : ''}`
}

/** 远程版本是否高于本地版本（compare-versions，无法解析时返回 false） */
export function isNewerVersion(remoteVersion?: string | null, localVersion?: string | null): boolean {
  if (!remoteVersion || !localVersion)
    return false

  try {
    return compare(remoteVersion, localVersion, '>')
  }
  catch (error) {
    console.warn('isNewerVersion compare failed', remoteVersion, localVersion, error)
    return false
  }
}

/** 当前 APP 版本是否大于等于指定版本 */
export function isNewerOrEqualVersion(targetVersion?: string | null): boolean {
  if (!globalThis.isElectron) {
    return true
  }

  if (!targetVersion)
    return false

  try {
    return compare(globalThis.$appVersion, targetVersion, '>=')
  }
  catch (error) {
    console.warn('isNewerOrEqualVersion compare failed', targetVersion, error)
    return false
  }
}

export async function checkWebForUpdates() {
  const remoteVersion = await fetch('/version').then(res => res.text()).catch(() => null)
  const localVersion = import.meta.env.VITE_VERSION

  if (remoteVersion && compare(remoteVersion, localVersion, '>')) {
    console.log(`New version available: ${remoteVersion} (current: ${localVersion})`)
    return remoteVersion
  }
  else {
    console.log(`Current version (${localVersion}) is up to date.`)
    return null
  }
}
