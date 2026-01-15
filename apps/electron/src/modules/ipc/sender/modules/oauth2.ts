import type { IPCMainInstance } from '../../types'

export function createOauth2Sender(ipcMain: IPCMainInstance) {
  return {
    /** google 授权登录 */
    googleCallback(payload: string) {
      return ipcMain.send('oauth2:google-callback', payload)
    },
  } as const
}
