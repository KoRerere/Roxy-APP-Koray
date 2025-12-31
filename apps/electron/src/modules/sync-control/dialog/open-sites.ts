import { ROXY_SYNC_CONTROL_OPEN_SITES_WINDOW_ID } from '/@/constants'
import { isPackaged } from '/@/constants/common'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import { handleWindowMove } from '/@/modules/sync-control/actionBar'
import { createWindow, getWindowById } from '/@/utils/browser-window'

export function getOpenSitesDialogWindow() {
  return getWindowById(ROXY_SYNC_CONTROL_OPEN_SITES_WINDOW_ID)
}

export async function openOpenSitesDialog() {
  const targetWin = getOpenSitesDialogWindow()

  if (targetWin) {
    targetWin.show()
    return
  }

  const win = createWindow({
    roxyWindowId: ROXY_SYNC_CONTROL_OPEN_SITES_WINDOW_ID,
    width: 450,
    height: 350,
    frame: false,
    alwaysOnTop: true,
    show: false,
    resizable: false,
    skipTaskbar: true,
    hasShadow: true,
  })
  win.loadURL(await getWebEntryUrl('#/sync-control-open-sites-dialog'))
  if (!isPackaged) {
    win.webContents.openDevTools()
  }
  handleWindowMove(win)
}

export function closeOpenSitesDialogWindow() {
  const targetWin = getOpenSitesDialogWindow()

  if (targetWin) {
    targetWin.close()
  }
}
