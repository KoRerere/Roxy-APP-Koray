import { isDev } from '/@/constants/common'
import { ipcMain } from '../index'
import { setupReceiverModules } from './modules'

export * from '../types'

setupReceiverModules(ipcMain)

if (isDev) {
  globalThis.ipcMain = ipcMain
}
