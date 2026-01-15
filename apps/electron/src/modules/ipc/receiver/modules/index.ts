import type { IPCMainInstance } from '/@/modules/ipc/types'
import { setupAppIpc } from './app'
import { setupBrowserIpc } from './browser'
import { setupCommonIpc } from './common'
import { setupExtensionIpc } from './extension'
import { setupMcpIpc } from './mcp'
import { setupProxyIpc } from './proxy'
import { setupSyncControlIpc } from './syncControl'
import { setupUserIpc } from './user'
import { setupUtilIpc } from './util'

export function setupReceiverModules(ipcMain: IPCMainInstance) {
  setupAppIpc(ipcMain)
  setupBrowserIpc(ipcMain)
  setupExtensionIpc(ipcMain)
  setupProxyIpc(ipcMain)
  setupUtilIpc(ipcMain)
  setupUserIpc(ipcMain)
  setupCommonIpc(ipcMain)
  setupSyncControlIpc(ipcMain)
  setupMcpIpc(ipcMain)
}
