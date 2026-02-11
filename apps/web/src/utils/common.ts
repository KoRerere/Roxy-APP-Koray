/** 是否处于开发环境 */
export const isDev = import.meta.env.DEV
/** 是否处于生产环境 */
export const isProd = import.meta.env.PROD
/** 是否是 Windows 系统 */
export const isWindows = navigator.platform.includes('Win')
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
  }, 1000 * 30)
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
