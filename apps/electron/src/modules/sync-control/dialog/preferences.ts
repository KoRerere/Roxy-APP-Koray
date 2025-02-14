import { app, BrowserWindow, ipcMain } from 'electron'
import { appConfig, ROXY_SYNC_CONTROL_PREFERENCES_WINDOW_ID, ROXY_WINDOW_ID_KEY } from '/@/constants'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import { isPackaged } from '/@/utils'
import { getSynchronizerActionBarWindow, handleWindowMove } from '/@/modules/sync-control/actionBar'

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

  const win = new BrowserWindow({
    width: 500,
    height: 500,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    show: false,
    skipTaskbar: true,
    hasShadow: true,
    webPreferences: {
      preload: appConfig.preloadFilePath
    },
  })
  win[ROXY_WINDOW_ID_KEY] = ROXY_SYNC_CONTROL_PREFERENCES_WINDOW_ID
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
