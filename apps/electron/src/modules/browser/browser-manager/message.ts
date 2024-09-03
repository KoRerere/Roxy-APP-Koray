import { errorDataWrapper, ipcMain, successDataWrapper } from '/@/modules/ipc'

interface MessageParams {
  dirId: string
  percent: number
  message: string
}

/** 发送成功的消息到渲染进程 */
export function sendSuccessMessage(params: MessageParams) {
  ipcMain.send('browser:launch-process-message', successDataWrapper(params))
}

/** 发送错误的消息到渲染进程 */
export function sendErrorMessage(message: string, dirId: string, error?: any) {
  ipcMain.send('browser:launch-process-message', errorDataWrapper(message, dirId, error))
}
