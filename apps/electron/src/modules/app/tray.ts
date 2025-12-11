import { app, Menu, Tray } from 'electron'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { getMainWindow } from '/@/modules/app/mainWindow'

let tray: Tray
/** 创建托盘 */
export async function createTray() {
  await setTimeout()
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
    getMainWindow()?.restore()
    getMainWindow()?.setSkipTaskbar(false)
  })
  return tray
}

/** 创建托盘菜单 */
function createContextMenu() {
  return Menu.buildFromTemplate([
    {
      label: $t('显示'),
      click: () => {
        getMainWindow()?.restore()
      },
    },
    {
      label: $t('退出'),
      click: () => {
        tray.destroy()
        getMainWindow()?.destroy()
      },
    },
  ])
}

export function getTray() {
  return tray
}
