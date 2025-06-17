import { BrowserWindow, } from 'electron'
import { ROXY_SYNC_CONTROL_PREFERENCES_WINDOW_ID, ROXY_WINDOW_ID_KEY } from '/@/constants'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import { isPackaged } from '/@/constants/common'
import { handleWindowMove } from '/@/modules/sync-control/actionBar'
import { createWindow } from '/@/utils/browser-window'

export function getPreferencesDialogWindow() {
  return BrowserWindow.getAllWindows().find((win) => win[ROXY_WINDOW_ID_KEY] === ROXY_SYNC_CONTROL_PREFERENCES_WINDOW_ID)
}

export type OpenPreferencesDialogPayload = { tab: 'base' | 'customLayout' | 'simulate' }

export async function openPreferencesDialog(payload: OpenPreferencesDialogPayload = { tab: 'base' }) {
  const { tab } = payload
  const targetWin = getPreferencesDialogWindow()

  if (targetWin) {
    targetWin.show()
    return
  }

  const win = createWindow({
    roxyWindowId: ROXY_SYNC_CONTROL_PREFERENCES_WINDOW_ID,
    width: 500,
    height: 500,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    show: false,
    skipTaskbar: true,
    hasShadow: true,
  })
  win.loadURL(await getWebEntryUrl(`#/sync-control-preferences-dialog?tab=${tab}`))
  if (!isPackaged) {
    win.webContents.openDevTools()
  }
  handleWindowMove(win)
}


export function closePreferencesDialogWindowWindow() {
  const targetWin = getPreferencesDialogWindow()

  if (targetWin) {
    targetWin.close()
  }
}



export function resizePreferencesDialog(payload: { width: number, height: number }) {
  const { width = 450, height = 380 } = payload
  const targetWin = getPreferencesDialogWindow()


  if (targetWin) {
    targetWin.resizable = true
    targetWin.setSize(width, height)
    targetWin.resizable = false
  }

}
