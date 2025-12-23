import { app, BrowserWindow, dialog, globalShortcut } from 'electron'
import { API } from '/@/api'
import { getMainWindow } from '/@/modules/app/mainWindow'
import { getTray } from '/@/modules/app/tray'
import { stopRoxynet } from '/@/modules/roxynet'
import { forceSaveConfig, store } from '/@/modules/store'
import { appUpdater } from '/@/modules/updater'
import { killProcessByName } from '/@/utils'

const closeSoftMap = {
  0: 'min',
  1: 'pop',
  2: 'exit',
} as const

/** 处理关闭窗口事件, 根据用户设置决定关闭窗口的行为 */
export function handleCloseWindow(event: Electron.Event) {
  if (store.token) {
    store.lastLoginTime = Date.now()
    forceSaveConfig()
  }
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
        buttons: [$t('最小化到托盘'), $t('取消'), $t('退出程序')],
        title: $t('提示'),
        message: $t('您点击了关闭按钮，您确定：'),
        checkboxLabel: $t('记住我的选择'),
        checkboxChecked: false,
        defaultId: 0,
      },
    ).then(async ({ response, checkboxChecked }) => {
      win.setEnabled(true)
      win.focus()
      console.log('handleCloseWindow', response, checkboxChecked, closeSoftMap[response])
      // 记住用户的选择
      if (checkboxChecked && closeSoftMap[response]) {
        await API.base.userSetUserConfigCreate({
          closeSoft: closeSoftMap[response],
        }).catch(console.error)
        store.closeSoft = closeSoftMap[response]
      }

      // 根据用户的选择执行相应的操作
      if (response === 0) {
        // 取消退出
        // win.minimize()
        win.setSkipTaskbar(true)
        win.hide()
      }
      else if (response === 1) {
        // event.preventDefault();
      }
      else {
        tray.destroy()
        BrowserWindow.getAllWindows().forEach(win => win.destroy())
      }
    })
  }
  else if (closeSoft === 'min') {
    event.preventDefault()
    // win.minimize()
    win.setSkipTaskbar(true)
    win.hide()
  }
}

/** 退出所有浏览器进程, 防止有漏网之鱼 */
export function killAllBrowserProcess() {
  killProcessByName('RoxyChrome')
  killProcessByName('chromedriver')
  killProcessByName('chrome_proxy')
}

/** 清理和释放资源 */
export function cleanupAndExit() {
  try {
    globalShortcut.unregisterAll()
    killAllBrowserProcess()
    BrowserWindow.getAllWindows().forEach(win => win.destroy())
    getTray()?.destroy()
    stopRoxynet()
    // 杀死整个进程组（包括 zygote、roxynet 等子进程）
    process.kill(-process.pid, 'SIGKILL')
  }
  catch {
    // 如果失败（比如不是进程组领导者），直接退出
    app.exit(0)
  }
}
