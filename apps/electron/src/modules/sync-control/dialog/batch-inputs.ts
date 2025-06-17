import { BrowserWindow, } from 'electron'
import { ROXY_SYNC_CONTROL_BATCH_INPUTS_WINDOW_ID, ROXY_WINDOW_ID_KEY } from '/@/constants'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import { isPackaged } from '/@/constants/common'
import { handleWindowMove } from '/@/modules/sync-control/actionBar'
import { createWindow } from '/@/utils/browser-window'

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

  const win = createWindow({
    roxyWindowId: ROXY_SYNC_CONTROL_BATCH_INPUTS_WINDOW_ID,
    width: 450,
    height: 374,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    show: false,
    skipTaskbar: true,
    hasShadow: true,
  })
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
