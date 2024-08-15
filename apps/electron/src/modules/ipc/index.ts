import { IPCMain } from '@roxy/electron-preload/main'
import type { MainMessage, RenderMessage } from '@roxy/electron-preload'

/**
 * Setup the IPC functions.
 */
export function setupIpc() {
  const ipcMain = new IPCMain<RenderMessage, MainMessage>()

  ipcMain.on('getUsernameById', (userID) => {
    console.log('getUsernameById', `User ID: ${userID}`)
    return 'User Name'
  })

  setTimeout(() => {
    ipcMain.send('newUserJoin', 1)
  }, 5000)

  return ipcMain
}
