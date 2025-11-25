import { Session, session } from 'electron'
import { setSystemProxy } from '/@/modules/roxynet'

let systemProxyAddr: string

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
  sess ||= session.fromPartition('persist:resolveProxy')

  const proxy = await sess.resolveProxy('https://www.google.com')
  const currSystemProxyAddr = proxy === 'DIRECT'
    ? ''
    : proxy?.split(' ').at(-1)?.split(';')?.filter(n => n !== 'DIRECT')?.[0] || ''

  if (currSystemProxyAddr !== systemProxyAddr) {
    // 系统代理地址发生变化，重新设置系统代理
    queueMicrotask(() => setSystemProxy())
  }
  if (systemProxyAddr !== currSystemProxyAddr) {
    console.log('getSystemProxy resolveProxy', proxy)
  }
  systemProxyAddr = currSystemProxyAddr
  return systemProxyAddr
}
