import { setupAppIpc } from './app'
import { setupBrowserIpc } from './browser'
import { setupExtensionIpc } from './extension'
import { setupProxyIpc } from './proxy'
import { setupUtilIpc } from './util'
import { setupUserIpc } from './user'
import { setupCommonIpc } from './common'
import { setupSyncControlIpc } from './syncControl'
import { IPCMainInstance } from '/@/modules/ipc/types'

export function setupIpc(ipcMain: IPCMainInstance) {
  setupAppIpc(ipcMain)
  setupBrowserIpc(ipcMain)
  setupExtensionIpc(ipcMain)
  setupProxyIpc(ipcMain)
  setupUtilIpc(ipcMain)
  setupUserIpc(ipcMain)
  setupCommonIpc(ipcMain)
  setupSyncControlIpc(ipcMain)
}
