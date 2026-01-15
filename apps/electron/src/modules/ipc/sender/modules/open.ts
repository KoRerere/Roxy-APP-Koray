import type { IPCMainInstance } from '../../types'

export function createOpenSender(ipcMain: IPCMainInstance) {
  return {
    /** 打开某个页面 */
    page(payload: string) {
      return ipcMain.send('open:page', payload)
    },
  } as const
}
