import { BrowserWindow, } from 'electron'
import { ROXY_SYNC_CONTROL_WINDOW_ID, ROXY_WINDOW_ID_KEY } from '/@/constants'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import { closeSynchronizerActionBarWindow, getSynchronizerActionBarWindow, handleWindowMove } from '/@/modules/sync-control/actionBar'
import { setTimeout } from 'timers/promises'
import { isPackaged } from '/@/constants/common'
import { closeAllSyncDialogs } from '/@/modules/sync-control/common'
import { createWindow } from '/@/utils/browser-window'

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

  const win = createWindow({
    roxyWindowId: ROXY_SYNC_CONTROL_WINDOW_ID,
    width: 556,
    height: 472,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    hasShadow: true,
    skipTaskbar: true,
    show: false,
  })

  win.loadURL(await getWebEntryUrl('#/sync-control-synchronizer'))
  // win.setShape([])
  // 设置窗口部分点击可穿透
  // win.setIgnoreMouseEvents(true);
  if (!isPackaged) {
    win.webContents.openDevTools()
  }
  handleWindowMove(win)
  win.on('close', async () => {
    win.destroy()
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
