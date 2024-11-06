import { app, dialog } from 'electron'
import { getMainWindow } from '/@/modules/app/mainWindow'
import { getTray } from '/@/modules/app/tray'
import { store } from '/@/modules/store'
import { appUpdater } from '/@/modules/updater'
import { killProcessByName } from '/@/utils'

/** 处理关闭窗口事件, 根据用户设置决定关闭窗口的行为 */
export function handleCloseWindow(event: Electron.Event) {
  // 如果是由更新触发的退出，不做任何处理
  if (appUpdater.isQuittingForUpdate) {
    return
  }

  const { closeSoft } = store
  const win = getMainWindow()!
  const tray = getTray()

  if (closeSoft === 'pop') {
    event.preventDefault()
    dialog.showMessageBox(
      win,
      {
        type: 'warning',
        buttons: ['最小化到托盘', '取消', '退出程序'],
        title: '提示',
        message: '您点击了关闭按钮，您确定：',
        defaultId: 0,
      },
    ).then(async ({ response }) => {
      win.setEnabled(true)
      win.focus()
      // 根据用户的选择执行相应的操作
      if (response === 0) {
        // 取消退出
        win.minimize()
        win.setSkipTaskbar(true)
      }
      else if (response === 1) {
        // event.preventDefault();
      }
      else {
        tray.destroy()
        win.destroy()
      }
    })
  }
  else if (closeSoft === 'min') {
    event.preventDefault()
    win.minimize()
    win.setSkipTaskbar(true)
  }
}

/** 退出所有浏览器进程, 防止有漏网之鱼 */
export function killAllBrowserProcess() {
  killProcessByName('RoxyChrome')
  killProcessByName('chromedriver')
  killProcessByName('chrome_proxy')
}
