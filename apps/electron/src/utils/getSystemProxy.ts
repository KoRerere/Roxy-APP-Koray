import type { ProbeResult } from '/@/utils/probe-proxy'
import type { Session } from 'electron'
import { session } from 'electron'
import { setSystemProxy } from '/@/modules/roxynet'
import { probeBestProxy } from '/@/utils/probe-proxy'

let systemProxyAddr: string
let systemProxyType = 'http'
let updateSystemProxyTypePromise: Promise<ProbeResult | void> | null = null

export function getSystemProxyAddress() {
  return systemProxyAddr
}

let reGetTime = Date.now()

let sess: Session

/** 获取系统代理设置 */
export async function getSystemProxy(force = false) {
  // 6秒内不重复获取
  if (!force && systemProxyAddr && Date.now() - reGetTime < 6 * 1000) {
    return {
      addr: systemProxyAddr,
      protocol: systemProxyType,
    }
  }
  reGetTime = Date.now()
  sess ||= session.fromPartition('persist:resolveProxy')

  const proxy = await sess.resolveProxy('https://www.google.com')
  const currSystemProxyAddr = proxy === 'DIRECT'
    ? ''
    : proxy?.split(' ').at(-1)?.split(';')?.filter(n => n !== 'DIRECT')?.[0] || ''

  if (updateSystemProxyTypePromise) {
    await updateSystemProxyTypePromise
  }

  if (currSystemProxyAddr !== systemProxyAddr) {
    // 系统代理地址发生变化，重新设置系统代理
    queueMicrotask(() => setSystemProxy())
    console.log('getSystemProxy resolveProxy', proxy)
    await updateSystemProxyType(currSystemProxyAddr)
  }
  systemProxyAddr = currSystemProxyAddr

  return {
    addr: systemProxyAddr,
    protocol: systemProxyType,
  }
}

async function updateSystemProxyType(systemProxyAddr: string) {
  const [host, port] = systemProxyAddr.split(':')
  if (host && port) {
    const timer = setTimeout(() => {
      updateSystemProxyTypePromise = null
    }, 5000)

    updateSystemProxyTypePromise = probeBestProxy({
      http: { host, port: Number(port) },
      socks5: { host, port: Number(port) },
      timeoutMs: 4000,
    }).catch((error) => {
      console.error('probeBestProxy error:', error)
    })

    const res = await updateSystemProxyTypePromise.finally(() => {
      clearTimeout(timer)
      updateSystemProxyTypePromise = null
    })

    if (res && res.ok) {
      systemProxyType = res.kind
    }
  }

  console.log('getSystemProxy result', {
    addr: systemProxyAddr,
    protocol: systemProxyType,
  })
}
