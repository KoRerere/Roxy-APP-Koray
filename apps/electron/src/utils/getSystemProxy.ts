import { getMainWindow } from '/@/modules/app/mainWindow'

let systemProxyAddr = ''

export function getSystemProxyAddress() {
  return systemProxyAddr
}

/** 获取系统代理设置 */
export async function getSystemProxy() {
  const proxy = await getMainWindow()?.webContents.session.resolveProxy('http://ip123.in/ip.json')
  console.log('getSystemProxy', proxy)
  systemProxyAddr = proxy === 'DIRECT' ? '' : proxy?.split(' ').at(-1) || ''
  return systemProxyAddr
}
