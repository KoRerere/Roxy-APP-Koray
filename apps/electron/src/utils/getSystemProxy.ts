import { getMainWindow } from '/@/modules/app/mainWindow'

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

  const proxy = await getMainWindow()?.webContents.session.resolveProxy('http://ip123.in/ip.json')
  console.log('getSystemProxy', proxy)
  systemProxyAddr = proxy === 'DIRECT' ? '' : proxy?.split(' ').at(-1) || ''
  return systemProxyAddr
}
