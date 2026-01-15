import type { BrowserProcessMessage } from '@roxy/electron-preload'
import { sendMessageToAllClients } from '/@/modules/appServer/ws'
import { errorDataWrapper, successDataWrapper } from '/@/modules/ipc'
import { ipcSender } from '/@/modules/ipc/sender'

/** 发送成功的消息到渲染进程 */
export function sendSuccessMessage(params: BrowserProcessMessage) {
  ipcSender.browser.launchProcessMessage(successDataWrapper(params))
  sendMessageToAllClients({
    type: 'browser:launch-process-message',
    ...params,
  })
}

/** 发送错误的消息到渲染进程 */
export function sendErrorMessage(message: string, dirId: string, error?: any) {
  ipcSender.browser.launchProcessMessage(errorDataWrapper(message, dirId, error))
  sendMessageToAllClients({
    type: 'browser:launch-process-message',
    ...errorDataWrapper(message, dirId, error),
  })
}
