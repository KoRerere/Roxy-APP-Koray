import { ROXY_SYNCING_CONTROL_SYNCING_WINDOW_LIST_WINDOW_ID } from '/@/constants'
import { isPackaged } from '/@/constants/common'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import { handleWindowMove } from '/@/modules/sync-control/actionBar'
import { createWindow, getWindowById } from '/@/utils/browser-window'

export function getSyncingWindowListWindow() {
  return getWindowById(ROXY_SYNCING_CONTROL_SYNCING_WINDOW_LIST_WINDOW_ID)
}

export async function openSyncingWindowList() {
  const targetWin = getSyncingWindowListWindow()

  if (targetWin) {
    targetWin.show()
    return
  }

  const win = createWindow({
    roxyWindowId: ROXY_SYNCING_CONTROL_SYNCING_WINDOW_LIST_WINDOW_ID,
    width: 480,
    height: 350,
    frame: false,
    alwaysOnTop: true,
    show: false,
    resizable: false,
    skipTaskbar: true,
    hasShadow: true,
  })
  win.loadURL(await getWebEntryUrl('syncing-window-list-dialog'))
  if (!isPackaged) {
    win.webContents.openDevTools()
  }
  handleWindowMove(win)
}

export function closeSyncingWindowListWindow() {
  const targetWin = getSyncingWindowListWindow()

  if (targetWin) {
    targetWin.close()
  }
}
