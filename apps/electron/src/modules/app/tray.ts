import path from 'node:path'
import type { BrowserWindow } from 'electron'
import { Menu, Tray } from 'electron'

let tray: Tray
/** 创建托盘 */
export function createTray(win: BrowserWindow) {
  console.log('createTray')
  if (tray) {
    return tray
  }

  const iconPath = path.join(__dirname, '..', 'resources/roxy-tray.png')
  // 新建托盘
  tray = new Tray(iconPath)
  // 托盘名称
  tray.setToolTip('roxybrowser')
  // 托盘菜单
  const contextMenu = Menu.buildFromTemplate([{
    label: '显示',
    click: () => { win.show() },
  }, {
    label: '退出',
    click: () => {
      tray.destroy()
      win.destroy()
    },
  }])
  // 载入托盘菜单
  tray.setContextMenu(contextMenu)
  // 双击触发
  tray.on('click', () => {
    win.show()
    win.setSkipTaskbar(false)
  })
  return tray
}
