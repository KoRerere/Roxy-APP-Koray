import { BrowserWindow, } from 'electron'
import { appConfig, ROXY_SYNCING_CONTROL_SYNCING_WINDOW_LIST_WINDOW_ID, ROXY_WINDOW_ID_KEY } from '/@/constants'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import { isPackaged } from '/@/utils'
import { handleWindowMove } from '/@/modules/sync-control/actionBar'

export function getSyncingWindowListWindow() {
  return BrowserWindow.getAllWindows().find((win) => win[ROXY_WINDOW_ID_KEY] === ROXY_SYNCING_CONTROL_SYNCING_WINDOW_LIST_WINDOW_ID)
}

export async function openSyncingWindowList() {
  const targetWin = getSyncingWindowListWindow()

  if (targetWin) {
    targetWin.show()
    return
  }

  const win = new BrowserWindow({
    width: 480,
    height: 350,
    frame: false,
    alwaysOnTop: true,
    show: false,
    resizable: false,
    skipTaskbar: true,
    hasShadow: true,
    webPreferences: {
      preload: appConfig.preloadFilePath
    },
  })
  win[ROXY_WINDOW_ID_KEY] = ROXY_SYNCING_CONTROL_SYNCING_WINDOW_LIST_WINDOW_ID
  win.loadURL(await getWebEntryUrl('#/syncing-window-list-dialog'))
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
