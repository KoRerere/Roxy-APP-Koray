import type { BrowserProcessMessage } from '@roxy/electron-preload'
import { sendMessageToAllClients } from '/@/modules/appServer/ws'
import { errorDataWrapper, ipcMain, successDataWrapper } from '/@/modules/ipc'

/** 发送成功的消息到渲染进程 */
export function sendSuccessMessage(params: BrowserProcessMessage) {
  ipcMain.send('browser:launch-process-message', successDataWrapper(params))
  sendMessageToAllClients({
    type: 'browser:launch-process-message',
    ...params,
  })
}

/** 发送错误的消息到渲染进程 */
export function sendErrorMessage(message: string, dirId: string, error?: any) {
  ipcMain.send('browser:launch-process-message', errorDataWrapper(message, dirId, error))
  sendMessageToAllClients({
    type: 'browser:launch-process-message',
    ...errorDataWrapper(message, dirId, error),
  })
}
