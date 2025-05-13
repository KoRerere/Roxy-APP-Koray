import { session } from 'electron'

let systemProxyAddr = ''

export function getSystemProxyAddress() {
  return systemProxyAddr
}

let reGetTime = Date.now()

/** 获取系统代理设置 */
export async function getSystemProxy(force = false) {
  // 6秒内不重复获取
  if (!force && systemProxyAddr && Date.now() - reGetTime < 6 * 1000) {
    return systemProxyAddr
  }
  reGetTime = Date.now()

  const proxy = await session.defaultSession.resolveProxy('https://www.google.com')
  console.log('getSystemProxy resolveProxy', proxy)
  systemProxyAddr = proxy === 'DIRECT' ? '' : proxy?.split(' ').at(-1) || ''
  return systemProxyAddr
}
