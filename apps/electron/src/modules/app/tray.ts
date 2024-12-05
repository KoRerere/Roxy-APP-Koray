import { Menu, Tray } from 'electron'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { getMainWindow } from '/@/modules/app/mainWindow'

let tray: Tray
/** 创建托盘 */
export async function createTray() {
  await setTimeout()
  console.log('createTray')
  tray?.destroy()

  const iconPath = path.join(__dirname, '..', 'resources/roxy-tray.png')
  // 新建托盘
  tray = new Tray(iconPath)
  // 托盘名称
  tray.setToolTip('roxybrowser')
  // 托盘菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: $t('显示'),
      click: () => {
        getMainWindow()?.show()
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
  // 载入托盘菜单
  tray.setContextMenu(contextMenu)
  // 双击触发
  tray.on('click', () => {
    getMainWindow()?.show()
    getMainWindow()?.setSkipTaskbar(false)
  })
  return tray
}

export function getTray() {
  return tray
}
