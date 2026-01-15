import type { IPCMainInstance } from '../../types'

export function createExtensionSender(ipcMain: IPCMainInstance) {
  return {
    /** 插件下载进度, 如果 errorTips 不为空，则表示下载失败 */
    downloadProgress(payload: { extID: string, percent: number, errorTips?: string }) {
      return ipcMain.send('extension:download-progress', payload)
    },
  } as const
}
