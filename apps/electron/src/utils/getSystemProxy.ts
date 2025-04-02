import { session } from 'electron'

let systemProxyAddr = ''

export function getSystemProxyAddress() {
  return systemProxyAddr
}

let regetTime = Date.now()

/** 获取系统代理设置 */
export async function getSystemProxy(force = false) {
  // 1分钟内不重复获取
  if (!force && systemProxyAddr && Date.now() - regetTime < 60 * 1000) {
    return systemProxyAddr
  }
  regetTime = Date.now()

  const proxy = await session.defaultSession.resolveProxy('https://www.google.com')
  console.log('getSystemProxy resolveProxy', proxy)
  systemProxyAddr = proxy === 'DIRECT' ? '' : proxy?.split(' ').at(-1) || ''
  return systemProxyAddr
}
