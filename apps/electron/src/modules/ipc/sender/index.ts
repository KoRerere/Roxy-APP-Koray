import { isDev } from '/@/constants/common'
import { ipcMain } from '../index'
import { createSenderModules } from './modules'

export const ipcSender = createSenderModules(ipcMain)

export * from './modules'

if (isDev) {
  ;(globalThis as any).ipcSender = ipcSender
}
