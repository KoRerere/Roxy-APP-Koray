/** 是否处于开发环境 */
export const isDev = import.meta.env.DEV
/** 是否处于生产环境 */
export const isProd = import.meta.env.PROD
/** 是否是 Windows 系统 */
export const isWindows = navigator.platform.includes('Win')
/** 是否为主窗口 */
/* eslint-disable antfu/no-top-level-await */
export const isMainWindow = await globalThis.electronAPI?.send('app:isMainWindow').catch(() => true)

console.log('isDev', isDev)
console.log('isProd', isProd)
console.log('isMainWindow', isMainWindow)

export function showPageLoading() {
  document.querySelector('#page-loading')?.setAttribute('style', 'display: flex')
}

export function hidePageLoading() {
  document.querySelector('#page-loading')?.setAttribute('style', 'display: none')
}
