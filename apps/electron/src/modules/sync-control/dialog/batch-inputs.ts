import { ROXY_SYNC_CONTROL_BATCH_INPUTS_WINDOW_ID } from '/@/constants'
import { isPackaged } from '/@/constants/common'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import { handleWindowMove } from '/@/modules/sync-control/actionBar'
import { createWindow, getWindowById } from '/@/utils/browser-window'

export function getBatchInputsDialogWindow() {
  return getWindowById(ROXY_SYNC_CONTROL_BATCH_INPUTS_WINDOW_ID)
}

export interface OpenBatchInputsDialogPayload { tab: 'same' | 'diff' | 'random' }

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
  win.loadURL(await getWebEntryUrl(`sync-control-batch-inputs-dialog?tab=${payload.tab}`))
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
