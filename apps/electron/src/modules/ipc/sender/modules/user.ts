import type { IPCMainInstance } from '../../types'

export function createUserSender(ipcMain: IPCMainInstance) {
  return {
    /** 用户被挤号 */
    kickedOut(payload: { deviceName: string, createTime: string }) {
      return ipcMain.send('user:kicked-out', payload)
    },
    /** 埋点上报事件 */
    mixpanelTrack(event_name: string, data?: Record<string, any>) {
      return ipcMain.send('mixpanel:track', event_name, data)
    },
  } as const
}
