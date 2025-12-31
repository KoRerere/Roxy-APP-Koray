import { ROXY_SYNC_CONTROL_WINDOW_ID } from '/@/constants'
import { isPackaged } from '/@/constants/common'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import { browserManager } from '/@/modules/browser'
import { canUseSyncControl } from '/@/modules/store'
import { closeSynchronizerActionBarWindow, getSynchronizerActionBarWindow, handleWindowMove } from '/@/modules/sync-control/actionBar'
import { closeAllSyncDialogs } from '/@/modules/sync-control/common'
import { createWindow, getWindowById } from '/@/utils/browser-window'

export function getSynchronizerWindow() {
  return getWindowById(ROXY_SYNC_CONTROL_WINDOW_ID)
}

export async function createSynchronizerWindow() {
  // 如果操作栏窗口存在，则不创建
  if (getSynchronizerActionBarWindow()) {
    return
  }

  const targetWin = getSynchronizerWindow()

  if (targetWin) {
    targetWin.show()
    return
  }

  const win = createWindow({
    roxyWindowId: ROXY_SYNC_CONTROL_WINDOW_ID,
    width: 640,
    height: 560,
    // maxWidth: 750,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    hasShadow: true,
    skipTaskbar: true,
    show: false,
  })

  win.loadURL(await getWebEntryUrl('#/sync-control-synchronizer'))
  // win.setShape([])
  // 设置窗口部分点击可穿透
  // win.setIgnoreMouseEvents(true);
  if (!isPackaged) {
    win.webContents.openDevTools()
  }
  handleWindowMove(win)
  win.on('close', async () => {
    win.destroy()
    // 如果操作栏窗口存在，则不关闭
    if (!getSynchronizerActionBarWindow()) {
      closeAllSyncDialogs()
    }
  })
}

export function closeSynchronizerWindow() {
  const targetWin = getSynchronizerWindow()

  if (targetWin) {
    targetWin.close()
  }
  closeSynchronizerActionBarWindow()
}

export async function checkOpenedBrowserStatus() {
  let force = true
  for (const [dirId, browserItem] of browserManager.openedBrowserMap) {
    if (!browserItem.winInfo.$canUseSyncControl) {
      Reflect.set(browserItem.winInfo, '$canUseSyncControl', await canUseSyncControl(force))
      browserManager.openedBrowserMap.set(dirId, browserItem)
      force = false
    }
  }
}
