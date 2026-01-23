import { app, Menu, Tray } from 'electron'
import path from 'node:path'
import { setTimeout as setTimeoutPromise } from 'node:timers/promises'
import { isWindows } from '/@/constants/common'
import { isAppQuittingForUpdate } from '/@/modules/app'
import { restoreOrCreateWindow } from '/@/modules/app/mainWindow'
import { isUninstallFeedbackMode } from '/@/modules/app/uninstallFeedback'
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
      click: () => {
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
