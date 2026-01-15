import type { IPCMainInstance } from '../../types'

export function createWindowSender(ipcMain: IPCMainInstance) {
  return {
    /** 当主窗口聚焦时 */
    onFocus() {
      return ipcMain.send('window:on-focus')
    },
  } as const
}
