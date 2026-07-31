import type { IPCMainInstance } from '../../types'
import type { BrowserCacheRootDirFallbackPayload, QuitSyncProgressMessage, ResourceUpdateMessage } from '@roxy/electron-preload'

export function createAppSender(ipcMain: IPCMainInstance) {
  return {
    /** APP、patch、web 资源更新事件 */
    resourceUpdate(payload: ResourceUpdateMessage) {
      return ipcMain.send('app:resource-update', payload)
    },

    /** APP 启动时的消息 */
    launchMessage(payload: string) {
      return ipcMain.send('app:launch-message', payload)
    },

    /** 内核列表有更新时，发出 */
    coreListUpdate(payload: ResourceUpdateMessage[]) {
      return ipcMain.send('app:core-list-update', payload)
    },

    /** 卸载反馈模式（由卸载程序启动） */
    uninstallFeedbackMode(isUninstallMode: boolean) {
      return ipcMain.send('app:uninstall-feedback-mode', isUninstallMode)
    },

    /** 退出/升级前同步窗口数据进度 */
    quitSyncProgress(payload: QuitSyncProgressMessage) {
      return ipcMain.send('app:quit-sync-progress', payload)
    },

    /** 缓存目录不可用，已回退默认路径 */
    browserCacheRootDirFallback(payload: BrowserCacheRootDirFallbackPayload) {
      return ipcMain.send('app:browser-cache-root-dir-fallback', payload)
    },
  } as const
}
