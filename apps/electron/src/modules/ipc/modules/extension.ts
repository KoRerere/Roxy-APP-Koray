
import { IPCMainInstance } from "/@/modules/ipc/types"
import { ExtensionManager } from "/@/modules/extension"

export function setupExtensionIpc(ipcMain: IPCMainInstance) {


  /** 下载指定插件 */
  ipcMain.on('extension:download', (event, extensions) => {
    const extensionManager = new ExtensionManager()
    return extensionManager.downloadExtensions(extensions)
  })

  /** 删除指定插件 */
  ipcMain.on('extension:remove', (event, extIDs: string[]) => {
    const extensionManager = new ExtensionManager()
    return extensionManager.removeExtensions(extIDs)
  })

  /** 获取并解析用户本地选择的插件信息 */
  ipcMain.on('extension:getSelectedExtensionInfo', (event, selectType: 'dir' | 'file') => {
    const extensionManager = new ExtensionManager()
    return extensionManager.getUserSelectedExtensionInfo(selectType)
  })

  /** 上传本地插件到 OSS */
  ipcMain.on('extension:uploadExtensionToOSS', (event, payload) => {
    const extensionManager = new ExtensionManager()
    return extensionManager.uploadExtensionToOSS(payload)
  })

  /** 检测本地插件是否有可用的更新，返回结果是插件ID字符串数组，表示本地哪些插件时可以更新的 */
  ipcMain.on('extension:checkLocalExtensionUpdate', (event, checkList) => {
    const extensionManager = new ExtensionManager()
    return extensionManager.checkLocalExtensionUpdate(checkList)
  })

  /** 获取本地已安装的插件 */
  ipcMain.on('extension:getInstalledExtensions', (event,) => {
    const extensionManager = new ExtensionManager()
    return extensionManager.getInstalledExtensions()
  })

  /** 根据插件 ID 获取插件信息 */
  ipcMain.on('extension:getExtensionInfo', (event, extID: string) => {
    const extensionManager = new ExtensionManager()
    return extensionManager.getExtensionInfo(extID)
  })

  /** 显示插件所在文件夹 */
  ipcMain.on('extension:showExtensionDir', (event, extID: string) => {
    const extensionManager = new ExtensionManager()
    return extensionManager.showExtensionDir(extID)
  })
}
