import { getMainWindow } from '/@/modules/app/mainWindow'

/** 获取系统代理设置 */
export async function getSystemProxy() {
  const proxy = await getMainWindow()?.webContents.session.resolveProxy('http://ip123.in/ip.json')
  console.log('getSystemProxy', proxy)
  return proxy === 'DIRECT' ? '' : proxy
}
