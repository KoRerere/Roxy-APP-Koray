import { app, dialog, Menu, Tray } from 'electron'
import path from 'node:path'
import { setTimeout as setTimeoutPromise } from 'node:timers/promises'
import { API } from '/@/api'
import { isWindows } from '/@/constants/common'
import { isAppQuittingForUpdate } from '/@/modules/app'
import { getMainWindow, restoreOrCreateWindow } from '/@/modules/app/mainWindow'
import { isUninstallFeedbackMode } from '/@/modules/app/uninstallFeedback'
import { browserManager } from '/@/modules/browser'
import { forceSaveConfig, store } from '/@/modules/store'
import { appUpdater } from '/@/modules/updater'
import { closeAllWindows } from '/@/utils/browser-window'

let tray: Tray
/** 创建托盘 */
export async function createTray() {
  await setTimeoutPromise()
  if (isUninstallFeedbackMode) {
    return
  }
  // 如果已经创建过托盘，直接返回, 因为
  if (tray) {
    tray.setContextMenu(createContextMenu())
    return tray
  }

  const iconPath = path.join(import.meta.dirname, '..', 'resources/roxy-tray.png')
  // 新建托盘
  tray = new Tray(iconPath)
  // 托盘名称
  tray.setToolTip(app.getName())

  // 载入托盘菜单
  tray.setContextMenu(createContextMenu())
  // 双击触发
  tray.on('click', () => {
    restoreOrCreateWindow()
  })
  return tray
}

/** 创建托盘菜单 */
function createContextMenu() {
  return Menu.buildFromTemplate([
    {
      label: $t('重启客户端'),
      click: async () => {
        if (store.autoRestoreWindow === 2) {
          await showAutoRestoreWindowDialog()
        }

        // 用户选择了下次启动时恢复窗口
        store.needRestoreWindow = store.autoRestoreWindow === 1

        await forceSaveConfig()

        appUpdater.quitAndInstall()
        setTimeout(() => {
          if (isAppQuittingForUpdate()) {
            return
          }
          app.relaunch()
          isWindows ? app.quit() : app.exit(0)
        }, 1000)
      },
    },
    {
      label: $t('显示'),
      click: () => {
        restoreOrCreateWindow()
      },
    },
    {
      label: $t('退出'),
      click: () => {
        tray.destroy()
        closeAllWindows()
        app.quit()
      },
    },
  ])
}

export function getTray() {
  return tray
}

async function showAutoRestoreWindowDialog() {
  // 如果当前没有打开的浏览器，则不显示对话框
  if (browserManager.openedBrowserMap.size === 0) {
    return
  }

  const win = getMainWindow()!

  const { response, checkboxChecked } = await dialog.showMessageBox(
    win,
    {
      type: 'warning',
      buttons: [$t('是'), $t('否')],
      title: $t('提示'),
      message: $t('下一次打开时是否恢复窗口？'),
      checkboxLabel: $t('记住我的选择'),
      checkboxChecked: false,
      defaultId: 0,
    },
  )

  win.setEnabled(true)
  win.focus()
  console.log('showAutoRestoreWindowDialog', response, checkboxChecked)
  const isAutoRestoreWindow = response === 0 ? 1 : 0
  // 记住用户的选择
  if (checkboxChecked) {
    await API.base.userSetUserConfigCreate({
      autoRestoreWindow: isAutoRestoreWindow,
    }).catch(console.error)
  }

  store.autoRestoreWindow = isAutoRestoreWindow
}
