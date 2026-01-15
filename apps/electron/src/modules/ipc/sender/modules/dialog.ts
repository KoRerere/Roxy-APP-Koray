import type { OpenBrowserFailureType } from '@roxy/electron-preload'
import type { IPCMainInstance } from '../../types'

export function createDialogSender(ipcMain: IPCMainInstance) {
  return {
    /** 通过外部打开浏览器失败错误弹窗 */
    openBrowserFailed(payload: { name: string, type: OpenBrowserFailureType, message?: string }) {
      return ipcMain.send('dialog:open-browser-failed', payload)
    },
  } as const
}
