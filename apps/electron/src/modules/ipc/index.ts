import type { MainMessage, RenderMessage } from '@roxy/electron-preload'
import { IPCMain } from '@roxy/electron-preload/main'
import { setupIpc } from '/@/modules/ipc/modules'
export * from './types'

export const ipcMain = new IPCMain<RenderMessage, MainMessage>()
setupIpc(ipcMain)


