import type { IPCMainInstance } from '../../types'

export function createInviteSender(ipcMain: IPCMainInstance) {
  return {
    /** 邀请用户进入项目 */
    toProject(payload: string) {
      return ipcMain.send('invite:to-project', payload)
    },
  } as const
}
