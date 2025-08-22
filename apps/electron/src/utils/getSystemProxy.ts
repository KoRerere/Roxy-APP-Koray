import { Session, session } from 'electron'
import { setSystemProxy } from '/@/modules/roxynet'

let systemProxyAddr = ''

export function getSystemProxyAddress() {
  return systemProxyAddr
}

let reGetTime = Date.now()

let sess: Session

/** 获取系统代理设置 */
export async function getSystemProxy(force = false) {
  // 6秒内不重复获取
  if (!force && systemProxyAddr && Date.now() - reGetTime < 6 * 1000) {
    return systemProxyAddr
  }
  reGetTime = Date.now()
  sess ||= session.fromPartition('persist:work')

  const proxy = await sess.resolveProxy('https://www.google.com')
  console.log('getSystemProxy resolveProxy', proxy)
  const currSystemProxyAddr = proxy === 'DIRECT' ? '' : proxy?.split(' ').at(-1) || ''
  if (currSystemProxyAddr !== systemProxyAddr) {
    // 系统代理地址发生变化，重新设置系统代理
    setSystemProxy()
  }
  systemProxyAddr = currSystemProxyAddr
  return systemProxyAddr
}
