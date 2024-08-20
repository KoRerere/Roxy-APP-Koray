import { IPCMain } from '@roxy/electron-preload/main'
import type { MainMessage, RenderMessage } from '@roxy/electron-preload'
import { browserManager } from '/@/modules/browser'

/**
 * Setup the IPC functions.
 */
export function setupIpc() {
  const ipcMain = new IPCMain<RenderMessage, MainMessage>()

  ipcMain.on('browser:launch', (winItemInfo) => {
    return browserManager.launch(winItemInfo)
  })

  ipcMain.on('browser:batchLaunch', (winItemList) => {
    return browserManager.batchLaunch(winItemList)
  })

  return ipcMain
}
