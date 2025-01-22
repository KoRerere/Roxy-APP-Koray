import { BrowserWindow, } from 'electron'
import { appConfig, ROXY_SYNC_CONTROL_WINDOW_ID, ROXY_WINDOW_ID_KEY } from '/@/constants'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import { closeSynchronizerActionBarWindow, getSynchronizerActionBarWindow, handleWindowMove } from '/@/modules/sync-control/actionBar'
import { setTimeout } from 'timers/promises'
import { isPackaged } from '/@/utils'
import { closeAllSyncDialogs } from '/@/modules/sync-control/common'

export function getSynchronizerWindow() {
  return BrowserWindow.getAllWindows().find((win) => win[ROXY_WINDOW_ID_KEY] === ROXY_SYNC_CONTROL_WINDOW_ID)
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

  const win = new BrowserWindow({
    width: 556,
    height: 472,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    hasShadow: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: appConfig.preloadFilePath
    },
  })
  win[ROXY_WINDOW_ID_KEY] = ROXY_SYNC_CONTROL_WINDOW_ID
  win.loadURL(await getWebEntryUrl('#/sync-control-synchronizer'))
  // win.setShape([])
  // 设置窗口部分点击可穿透
  // win.setIgnoreMouseEvents(true);
  if (!isPackaged) {
    win.webContents.openDevTools()
  }
  handleWindowMove(win)
  win.on('close', async () => {
    await setTimeout(1500)
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
