import { IPCMain } from '@roxy/electron-preload/main'
import type { MainMessageResult } from '@roxy/electron-preload/main'
import type { MainMessage, RenderMessage } from '@roxy/electron-preload'
import { browserManager } from '/@/modules/browser'

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

ipcMain.on('browser:launch', (winItemInfo) => {
  return browserManager.launch(winItemInfo)
})

ipcMain.on('browser:batchLaunch', (winItemList) => {
  return browserManager.batchLaunch(winItemList)
})
