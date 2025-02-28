

import { browserManager } from "/@/modules/browser"
import { IPCMainInstance } from "/@/modules/ipc/types"

export function setupBrowserIpc(ipcMain: IPCMainInstance) {

  /** 批量启动浏览器 */
  ipcMain.on('browser:batchLaunch', (event, dirIds) => {
    return browserManager.batchLaunch(dirIds)
  })

  /** 批量关闭浏览器 */
  ipcMain.on('browser:batchClose', (event, dirIds: string[]) => {
    return browserManager.batchClose(dirIds)
  })

  /** 批量重启浏览器 */
  ipcMain.on('browser:batchRelaunch', (event, dirIds) => {
    return browserManager.batchReLaunch(dirIds)
  })

  /** 批量删除本地浏览器 */
  ipcMain.on('browser:batchRemove', (event, dirIds) => {
    return browserManager.batchDelete(dirIds)
  })

  /** 根据进程 PID 判断进程是否存在 */
  ipcMain.on('browser:isProcessExists', (event, dirIds) => {
    return Promise.all(dirIds.map(async (dirId) => {
      const browserItem = browserManager.openedBrowserMap.get(dirId)
      const isExists = await browserItem?.beforeLaunchTask.reconnectBrowser()
      if (!isExists) {
        browserItem?.handleOnDisconnected()
      }
      return isExists
    }))
  })

  /** 获取所有已打开的窗口 */
  ipcMain.on('browser:getOpenedBrowser', (event,) => {
    return Array.from(browserManager.openedBrowserMap.values()).map(browserItem => {
      return {
        ...browserItem.winInfo,
        $pId: browserItem.launchInfo?.pid,
      }
    })
  })

  /** 获取所有已打开的窗口的消息 */
  ipcMain.on('browser:getOpenedBrowserMessage', (event) => {
    return Array.from(browserManager.openedBrowserMap.values()).map(browserItem => browserItem.lastMessage!)
  })

  /**
   * 清除浏览器缓存
   * @param type 清除类型
   * excludeExtension 清除本地缓存，保留插件
   * all 清除本地缓存
   */
  ipcMain.on('browser:clearCache', async (event, payload) => {
    const { clearType, dirId } = payload
    if (clearType === 'all') {
      // 清除本地缓存
      console.log('清除本地缓存', dirId)
      await browserManager.removeLocalData(dirId)
    }
    else if (clearType === 'partial') {
      // 清除本地缓存，保留插件
      console.log('清除本地缓存，保留插件', dirId)
      await browserManager.removeLocalDataExcludeExtension(dirId)
    }
  })
}
