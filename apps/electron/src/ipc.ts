import { IPCMain, } from '@roxy/electron-preload/main'
import { RenderMessage, MainMessage } from '@roxy/electron-preload'


export const ipcMain = new IPCMain<RenderMessage, MainMessage>()

ipcMain.on('getUsernameById', (userID) => {
  console.log('getUsernameById', `User ID: ${userID}`)
  return 'User Name'
})


setTimeout(() => {
  ipcMain.send('newUserJoin', 1)
}, 5000)
