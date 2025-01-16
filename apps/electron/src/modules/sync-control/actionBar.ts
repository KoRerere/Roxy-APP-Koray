import { app, BrowserWindow, ipcMain } from 'electron'
import { appConfig, ROXY_SYNC_CONTROL_ACTION_BAR_WINDOW_ID, ROXY_WINDOW_ID_KEY } from '/@/constants'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'

export function getSynchronizerActionBarWindow() {
  return BrowserWindow.getAllWindows().find((win) => win[ROXY_WINDOW_ID_KEY] === ROXY_SYNC_CONTROL_ACTION_BAR_WINDOW_ID)
}

export async function createSynchronizerActionBarWindow() {
  const targetWin = getSynchronizerActionBarWindow()

  if (targetWin) {
    targetWin.show()
    return
  }

  const win = new BrowserWindow({
    width: 1000,
    height: 600,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: appConfig.preloadFilePath
    },
  })
  win.setBounds({
    y: 20
  })
  // 默认鼠标事件穿透
  win.setIgnoreMouseEvents(true, { forward: true })
  win[ROXY_WINDOW_ID_KEY] = ROXY_SYNC_CONTROL_ACTION_BAR_WINDOW_ID
  win.loadURL(await getWebEntryUrl('#/sync-control-action-bar'))
  // win.setShape([])
  // 设置窗口部分点击可穿透
  // win.setIgnoreMouseEvents(true);
  win.webContents.openDevTools()
}


export function closeSynchronizerWindow() {
  const targetWin = getSynchronizerActionBarWindow()

  if (targetWin) {
    targetWin.close()
  }
}
