import { ROXY_SYNC_CONTROL_CUSTOM_LAYOUTS_WINDOW_ID } from '/@/constants'
import { isPackaged } from '/@/constants/common'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import { handleWindowMove } from '/@/modules/sync-control/actionBar'
import { createWindow, getWindowById } from '/@/utils/browser-window'

export function getCustomLayoutDialogWindow() {
  return getWindowById(ROXY_SYNC_CONTROL_CUSTOM_LAYOUTS_WINDOW_ID)
}

export async function openCustomLayoutDialog() {
  const targetWin = getCustomLayoutDialogWindow()

  if (targetWin) {
    targetWin.show()
    return
  }

  const win = createWindow({
    roxyWindowId: ROXY_SYNC_CONTROL_CUSTOM_LAYOUTS_WINDOW_ID,
    width: 450,
    height: 290,
    frame: false,
    alwaysOnTop: true,
    show: false,
    resizable: false,
    skipTaskbar: true,
    hasShadow: true,
  })
  win.loadURL(await getWebEntryUrl('#/sync-control-custom-layout-dialog'))
  if (!isPackaged) {
    win.webContents.openDevTools()
  }
  handleWindowMove(win)
}

export function closeCustomLayoutsDialogWindow() {
  const targetWin = getCustomLayoutDialogWindow()

  if (targetWin) {
    targetWin.close()
  }
}
