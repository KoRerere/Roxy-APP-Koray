import { IPCMain } from '@roxy/electron-preload/main'
import type { MainMessage, MainMessageResult, RenderMessage } from '@roxy/electron-preload'
import { browserManager } from '/@/modules/browser'
import { proxyDetection } from '/@/utils'

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

ipcMain.on('proxy:detection', (winItemInfo) => {
  return proxyDetection(winItemInfo)
})

ipcMain.on('browser:batchLaunch', (winItemList) => {
  return browserManager.batchLaunch(winItemList)
})
