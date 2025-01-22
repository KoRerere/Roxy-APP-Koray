import { BrowserWindow, } from 'electron'
import { appConfig, ROXY_SYNC_CONTROL_CUSTOM_LAYOUTS_WINDOW_ID, ROXY_WINDOW_ID_KEY } from '/@/constants'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import { isPackaged } from '/@/utils'
import { handleWindowMove } from '/@/modules/sync-control/actionBar'

export function getCustomLayoutDialogWindow() {
  return BrowserWindow.getAllWindows().find((win) => win[ROXY_WINDOW_ID_KEY] === ROXY_SYNC_CONTROL_CUSTOM_LAYOUTS_WINDOW_ID)
}

export async function openCustomLayoutDialog() {
  const targetWin = getCustomLayoutDialogWindow()

  if (targetWin) {
    targetWin.show()
    return
  }

  const win = new BrowserWindow({
    width: 450,
    height: 290,
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
  win[ROXY_WINDOW_ID_KEY] = ROXY_SYNC_CONTROL_CUSTOM_LAYOUTS_WINDOW_ID
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
