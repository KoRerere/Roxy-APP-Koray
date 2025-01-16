
import { detectNetwork, getSystemProxy, proxyDetection, tryRefreshUrl } from "/@/utils"
import { delRoxynetProxy } from "/@/modules/roxynet"
import { IPCMainInstance } from "/@/modules/ipc/types"

export function setupProxyIpc(ipcMain: IPCMainInstance) {
  /** 代理检测 */
  ipcMain.on('proxy:detect', (event, winItemInfo) => {
    return proxyDetection(winItemInfo)
  })

  /** 删除 roxynet 代理 */
  ipcMain.on('proxy:delRoxynetProxy', (event, dirId) => {
    return delRoxynetProxy(dirId)
  })

  /** 根据用户设置，检测本地网络/系统代理 */
  ipcMain.on('proxy:detectNetwork', async (event, type?: 'local' | 'system') => {
    return detectNetwork(type)
  })

  /** 获取系统代理 */
  ipcMain.on('proxy:getSystemProxy', (event,) => {
    return getSystemProxy(true)
  })

  /** 代理 => 刷新 URL */
  ipcMain.on('proxy:refreshUrl', (event, refreshUrl) => {
    return tryRefreshUrl(refreshUrl)
  })
}
