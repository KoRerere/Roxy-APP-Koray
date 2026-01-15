import type { IPCMainInstance } from '../../types'

export function createUserSender(ipcMain: IPCMainInstance) {
  return {
    /** 用户被挤号 */
    kickedOut(payload: { deviceName: string, createTime: string }) {
      return ipcMain.send('user:kicked-out', payload)
    },
  } as const
}
