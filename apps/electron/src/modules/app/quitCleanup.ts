import { globalShortcut } from 'electron'
import { killAllBrowserProcess } from '/@/modules/app/utils'
import { browserManager, coreManager } from '/@/modules/browser'
import { browserIconRenderWorker } from '/@/modules/browserIconRenderWorker'
import { appUpdater } from '/@/modules/updater'
import { closeAllWindows } from '/@/utils/browser-window'

let isBrowserDataSynced = false
let cleanupPromise: Promise<void> | null = null

export function isBrowserDataSyncedBeforeQuit() {
  return isBrowserDataSynced
}

export function resetBrowserDataSyncedBeforeQuit() {
  isBrowserDataSynced = false
  cleanupPromise = null
}

/**
 * 退出/升级前关闭所有浏览器并同步用户数据.
 * 幂等且可重入: 并发调用会等待同一次清理完成.
 */
export async function syncBrowserDataBeforeQuit(): Promise<void> {
  if (isBrowserDataSynced) {
    return
  }
  if (cleanupPromise) {
    return cleanupPromise
  }

  cleanupPromise = doSyncBrowserDataBeforeQuit()
  try {
    await cleanupPromise
  }
  finally {
    cleanupPromise = null
  }
}

async function doSyncBrowserDataBeforeQuit(): Promise<void> {
  console.log('Syncing browser data before quit...')
  try {
    // 先关闭指纹浏览器并同步数据 (含 OSS + 服务端 API), 再关 Electron 窗口
    await browserManager.closeAll({
      ensureServerSync: true,
      syncProgressReason: appUpdater.isQuittingForUpdate ? 'update' : 'quit',
    })
    console.log('Browser data sync completed before quit.')
  }
  catch (error) {
    // 窗口已关闭, 同步失败不阻断退出/升级
    console.error('browserManager.closeAll error (continuing quit):', error)
  }
  finally {
    console.log('Quit cleanup finally: closing windows and killing stray browser processes.')
    closeAllWindows()
    globalShortcut.unregisterAll()
    await killAllBrowserProcess()
    browserIconRenderWorker.terminate()
  }

  await coreManager.cleanOldCore()
  isBrowserDataSynced = true
}
