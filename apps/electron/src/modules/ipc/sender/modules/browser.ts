import type {
  BrowserProcessMessage,
  MainMessage,
  MainMessageResult,
  OpenBrowserFailureType,
} from '@roxy/electron-preload'
import type { IPCMainInstance } from '../../types'

export function createBrowserSender(ipcMain: IPCMainInstance) {
  return {
    /** 拉起内核过程中的信息 */
    launchProcessMessage(payload: MainMessageResult<BrowserProcessMessage>) {
      return ipcMain.send('browser:launch-process-message', payload)
    },

    /** 已打开的内核个数变化时发出 */
    openedBrowserListChange(
      winInfoList: Parameters<MainMessage['browser:opened-browser-list-change']>[0],
    ) {
      return ipcMain.send('browser:opened-browser-list-change', winInfoList)
    },

    /** 浏览器关闭时 */
    onClose(dirIds: string[]) {
      return ipcMain.send('browser:on-close', dirIds)
    },

    /** 浏览器关闭时，同步数据中 */
    onCloseSyncingData(dirIds: string[]) {
      return ipcMain.send('browser:on-close-syncing-data', dirIds)
    },

    /** 达到窗口打开次数限制 */
    windowOpenLimit(result: { code: number, msg: string }) {
      return ipcMain.send('browser:window-open-limit', result)
    },

    /** 连接内核调试端口失败，127.0.0.1 被拦截，一般的都是所有网络都被第三方程序接管了，然后导致丢包了，在驱动层做的，只有这些 vpn会干这些事情 */
    networkIntercepted() {
      return ipcMain.send('browser:network-intercepted')
    },

    /** 通过外部打开浏览器失败错误弹窗 */
    dialogOpenBrowserFailed(payload: { name: string, type: OpenBrowserFailureType, message?: string }) {
      return ipcMain.send('dialog:open-browser-failed', payload)
    },
  } as const
}
