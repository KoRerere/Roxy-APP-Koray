import type { MainMessage, RenderMessage } from '@roxy/electron-preload'
import { IPCMain } from '@roxy/electron-preload/main'
import { setupIpc } from '/@/modules/ipc/modules'
import { isDev } from '/@/constants/common'
export * from './types'

export const ipcMain = new IPCMain<RenderMessage, MainMessage>()
setupIpc(ipcMain)

if (isDev) {
  globalThis.ipcMain = ipcMain
}


