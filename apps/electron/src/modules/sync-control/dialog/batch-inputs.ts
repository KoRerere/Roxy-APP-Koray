import { BrowserWindow, } from 'electron'
import { appConfig, ROXY_SYNC_CONTROL_BATCH_INPUTS_WINDOW_ID, ROXY_WINDOW_ID_KEY } from '/@/constants'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import { isPackaged } from '/@/utils'
import { handleWindowMove } from '/@/modules/sync-control/actionBar'

export function getBatchInputsDialogWindow() {
  return BrowserWindow.getAllWindows().find((win) => win[ROXY_WINDOW_ID_KEY] === ROXY_SYNC_CONTROL_BATCH_INPUTS_WINDOW_ID)
}

export type OpenBatchInputsDialogPayload = { tab: 'same' | 'diff' | 'random' }


export async function openBatchInputsDialog(payload: OpenBatchInputsDialogPayload = { tab: 'same' }) {
  const targetWin = getBatchInputsDialogWindow()

  if (targetWin) {
    targetWin.show()
    return
  }

  const win = new BrowserWindow({
    width: 450,
    height: 374,
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
  win[ROXY_WINDOW_ID_KEY] = ROXY_SYNC_CONTROL_BATCH_INPUTS_WINDOW_ID
  win.loadURL(await getWebEntryUrl(`#/sync-control-batch-inputs-dialog?tab=${payload.tab}`))
  if (!isPackaged) {
    win.webContents.openDevTools()
  }
  handleWindowMove(win)
}


export function closeBatchInputsDialogWindow() {
  const targetWin = getBatchInputsDialogWindow()

  if (targetWin) {
    targetWin.close()
  }
}


export function resizeBatchInputsDialog(payload: { width: number, height: number }) {
  const targetWin = getBatchInputsDialogWindow()

  if (targetWin) {
    targetWin.resizable = true
    targetWin.setSize(payload.width, payload.height)
    targetWin.resizable = false
  }

}
