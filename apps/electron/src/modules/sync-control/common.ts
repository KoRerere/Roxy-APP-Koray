import { closeSynchronizerActionBarWindow } from "/@/modules/sync-control/actionBar"
import { closeBatchInputsDialogWindow } from "/@/modules/sync-control/dialog/batch-inputs"
import { closeCustomLayoutsDialogWindow } from "/@/modules/sync-control/dialog/custom-layout"
import { closeOpenSitesDialogWindow } from "/@/modules/sync-control/dialog/open-sites"
import { closePreferencesDialogWindowWindow } from "/@/modules/sync-control/dialog/preferences"
import { closeSyncingWindowListWindow } from "/@/modules/sync-control/dialog/syncing-window-list"
import { closeSynchronizerWindow } from "/@/modules/sync-control/synchronizer"


/** 关闭所有同步相关的弹窗 */
export function closeAllSyncDialogs() {
  closeSynchronizerWindow()
  closePreferencesDialogWindowWindow()
  closeCustomLayoutsDialogWindow()
  closeBatchInputsDialogWindow()
  closeOpenSitesDialogWindow()
  closeSyncingWindowListWindow()
}

/** 默认主控标题栏颜色 */
export const defaultMainControlWindowColor = 'C7CDD1'
