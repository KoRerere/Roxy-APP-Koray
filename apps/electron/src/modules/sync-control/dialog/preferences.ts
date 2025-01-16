import { app, BrowserWindow, ipcMain } from 'electron'
import { appConfig, ROXY_SYNC_CONTROL_PREFERENCES_WINDOW_ID, ROXY_WINDOW_ID_KEY } from '/@/constants'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'

export function getPreferencesDialogWindow() {
  return BrowserWindow.getAllWindows().find((win) => win[ROXY_WINDOW_ID_KEY] === ROXY_SYNC_CONTROL_PREFERENCES_WINDOW_ID)
}

export async function openPreferencesDialog() {
  const targetWin = getPreferencesDialogWindow()

  if (targetWin) {
    targetWin.show()
    return
  }

  const win = new BrowserWindow({
    width: 480,
    height: 610,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: true,
    webPreferences: {
      preload: appConfig.preloadFilePath
    },
  })
  win[ROXY_WINDOW_ID_KEY] = ROXY_SYNC_CONTROL_PREFERENCES_WINDOW_ID
  win.loadURL(await getWebEntryUrl('#/sync-control-preferences-dialog'))
  win.webContents.openDevTools()
}


export function closePreferencesDialogWindowWindow() {
  const targetWin = getPreferencesDialogWindow()

  if (targetWin) {
    targetWin.close()
  }
}
