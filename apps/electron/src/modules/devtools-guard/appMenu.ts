import type { MenuItemConstructorOptions } from 'electron'
import { Menu } from 'electron'
import { isMac } from '/@/constants/common'

/**
 * 收敛应用菜单，移除开发者工具入口。
 *
 * 此前未调用 setApplicationMenu，生产包沿用 Electron 默认菜单，其中 View 菜单
 * 自带 Toggle Developer Tools / Reload。这里：
 * - Windows/Linux 直接置空菜单；
 * - macOS 菜单栏无法真正置空（会退化成系统默认菜单），因此构建一个不含 View 菜单的
 *   最小模板，保留 App / Edit / Window，避免影响复制粘贴与 Command+Q。
 */
export function setupAppMenu() {
  if (!isMac) {
    Menu.setApplicationMenu(null)
    return
  }

  const template: MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    { role: 'editMenu' },
    { role: 'windowMenu' },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
