import { IPCMain } from '@roxy/electron-preload/main'
import type { MainMessage, MainMessageResult, RenderMessage } from '@roxy/electron-preload'
import { browserManager } from '/@/modules/browser'
import { proxyDetection } from '/@/utils'
import { store } from '/@/modules/store'

export const ipcMain = new IPCMain<RenderMessage, MainMessage>()

/** 成功的消息体 */
export function successDataWrapper<T>(data: T, message = 'success'): MainMessageResult<T> {
  return {
    code: 0,
    data,
    message,
  }
}

/** 错误的信息体 */
export function errorDataWrapper(message = 'error', data?: any, error?: any): MainMessageResult {
  return {
    code: 1,
    data,
    message,
    error,
  }
}

/** 代理检测 */
ipcMain.on('proxy:detection', (winItemInfo) => {
  return proxyDetection(winItemInfo)
})

/** 批量启动浏览器 */
ipcMain.on('browser:batchLaunch', (winItemList) => {
  return browserManager.batchLaunch(winItemList)
})

/** 批量删除本地浏览器 */
ipcMain.on('browser:batchRemove', (winItemList) => {
  return browserManager.batchLaunch(winItemList)
})

ipcMain.on('user:setUserInfo', (userInfo) => {
  store.userInfo = userInfo
})
