import type { IPCMainInstance } from '../../types'

export function createSyncControlSender(ipcMain: IPCMainInstance) {
  return {
    /** 同步窗口个数发生变化 */
    syncWindowCountChange(count: number) {
      return ipcMain.send('syncControl:syncWindowCountChange', count)
    },
    /** 开始同步窗口 */
    start() {
      return ipcMain.send('syncControl:start')
    },
    /** 停止同步窗口 */
    stop() {
      return ipcMain.send('syncControl:stop')
    },
    /** 宫格布局、堆叠布局、自定义布局 */
    doLayout() {
      return ipcMain.send('syncControl:doLayout')
    },
    /** 开启/关闭延迟点击 */
    toggleClickDelay() {
      return ipcMain.send('syncControl:toggleClickDelay')
    },
    /** 开启/关闭延迟输入 */
    toggleInputDelay() {
      return ipcMain.send('syncControl:toggleInputDelay')
    },
    /** 暂停同步 */
    pause() {
      return ipcMain.send('syncControl:pause')
    },
    /** 恢复同步 */
    resume() {
      return ipcMain.send('syncControl:resume')
    },
  } as const
}
