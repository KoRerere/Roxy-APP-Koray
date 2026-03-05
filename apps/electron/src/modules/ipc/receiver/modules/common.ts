import type { IPCMainInstance } from '/@/modules/ipc/types'
import { dialog } from 'electron'
import { osConfig } from '/@/constants'
import { updateDict } from '/@/modules/dict'
import { setWebReady } from '/@/utils'

export function setupCommonIpc(ipcMain: IPCMainInstance) {
  /** 选择文件夹 */
  ipcMain.on('dialog:selectDir', async (event, defaultPath?: string) => {
    try {
      const { filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        defaultPath,
      })
      return filePaths[0]
    }
    catch (error) {
      console.log(error)
      return ''
    }
  })

  /** 选择文件 */
  ipcMain.on('dialog:selectFile', async (event, filters) => {
    try {
      const { filePaths } = await dialog.showOpenDialog({ properties: ['openFile'], filters })
      return filePaths[0]
    }
    catch (error) {
      console.log(error)
      return ''
    }
  })

  /** 更新字典 */
  ipcMain.on('dict:update', async (event, dictKeys) => {
    await updateDict(dictKeys)
  })

  /** 前端已准备就绪 */
  ipcMain.on('web:ready', (event) => {
    console.log('web:ready')
    setWebReady()
  })

  /** 获取 os 配置，用于 APP 升级等接口的参数 */
  ipcMain.on('const:osConfig', (event) => {
    return osConfig
  })
}
