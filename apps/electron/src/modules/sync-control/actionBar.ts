import { BrowserWindow, } from 'electron'
import { appConfig, ROXY_SYNC_CONTROL_ACTION_BAR_WINDOW_ID, ROXY_WINDOW_ID_KEY } from '/@/constants'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import { isPackaged } from '/@/utils'
import { closeCustomLayoutsDialogWindow } from '/@/modules/sync-control/dialog/custom-layout'
import { closeBatchInputsDialogWindow } from '/@/modules/sync-control/dialog/batch-inputs'

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
    show: false,
    backgroundColor: "#FFF",
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    frame: false,
    webPreferences: {
      preload: appConfig.preloadFilePath
    },
  })
  win.setBounds({
    y: 20
  })
  // 默认鼠标事件穿透
  // win.setIgnoreMouseEvents(true, { forward: true })
  win[ROXY_WINDOW_ID_KEY] = ROXY_SYNC_CONTROL_ACTION_BAR_WINDOW_ID
  win.loadURL(await getWebEntryUrl('#/sync-control-action-bar'))
  // win.setShape([])
  // 设置窗口部分点击可穿透
  // win.setIgnoreMouseEvents(true);
  if (!isPackaged) {
    win.webContents.openDevTools({ mode: 'detach' })
  }

  setTimeout(() => {
    // 设置透明背景色
    win.setBackgroundColor('rgba(255, 255, 255, 0)')
  }, 100)

  win.on('close', async () => {
    closeCustomLayoutsDialogWindow()
    closeBatchInputsDialogWindow()
  })
}


export function closeSynchronizerActionBarWindow() {
  const targetWin = getSynchronizerActionBarWindow()

  if (targetWin) {
    targetWin.close()
  }
}


export function handleWindowMove(win: BrowserWindow) {
  win.on('move', () => {
    const actionBarWin = getSynchronizerActionBarWindow()
    actionBarWin?.setIgnoreMouseEvents(false)
  })

  win.on('moved', () => {
    const actionBarWin = getSynchronizerActionBarWindow()
    actionBarWin?.setIgnoreMouseEvents(true, { forward: true })
  })
}
