import { app, dialog, globalShortcut } from 'electron'
import { API } from '/@/api'
import { getMainWindow } from '/@/modules/app/mainWindow'
import { getTray } from '/@/modules/app/tray'
import { stopRoxynet } from '/@/modules/roxynet'
import { forceSaveConfig, store } from '/@/modules/store'
import { appUpdater } from '/@/modules/updater'
import { killProcessByName } from '/@/utils'
import { closeAllWindows } from '/@/utils/browser-window'
import { closeUninstallFeedbackWindow, createUninstallFeedbackWindow, isUninstallFeedbackMode } from './uninstallFeedback'

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
        closeAllWindows()
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

/** 是否正在显示卸载反馈窗口 */
let isShowingUninstallFeedback = false

/** 是否已确认退出 */
let isQuitConfirmed = false

/**
 * 显示卸载反馈窗口并等待用户操作
 */
export async function showUninstallFeedback(): Promise<void> {
  if (isShowingUninstallFeedback || isQuitConfirmed) {
    return
  }

  isShowingUninstallFeedback = true

  try {
    // 关闭主窗口
    const mainWindow = getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide()
    }

    // 显示卸载反馈窗口
    await createUninstallFeedbackWindow()
  }
  catch (error) {
    console.error('Failed to show uninstall feedback window:', error)
    isShowingUninstallFeedback = false
    // 如果显示失败，直接退出
    confirmQuit()
  }
}

/**
 * 确认退出应用
 */
export function confirmQuit() {
  if (isQuitConfirmed) {
    return
  }

  isQuitConfirmed = true
  isShowingUninstallFeedback = false

  // 如果是卸载反馈模式，退出码为 0（表示继续卸载）
  if (isUninstallFeedbackMode) {
    console.log('User confirmed uninstall, exiting with code 0')
    // 先关窗口，避免触发 closed 后又走 cancelQuit（由 cancelQuit 的保护兜底）
    closeUninstallFeedbackWindow()
    app.exit(0)
    return
  }

  cleanupAndExit()
}

/**
 * 取消退出（用户选择不卸载）
 */
export function cancelQuit() {
  // 已经确认退出/正在退出时，不再重复触发取消逻辑
  if (isQuitConfirmed) {
    return
  }
  isShowingUninstallFeedback = false
  closeUninstallFeedbackWindow()

  // 如果是卸载反馈模式，退出应用并返回退出码 1（表示取消卸载）
  if (isUninstallFeedbackMode) {
    isQuitConfirmed = true
    console.log('User cancelled uninstall, exiting with code 1')
    // 直接退出，返回退出码 1
    app.exit(1)
    return
  }

  // 恢复主窗口（非卸载模式）
  const mainWindow = getMainWindow()
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    mainWindow.focus()
  }
}

/** 清理和释放资源 */
export function cleanupAndExit() {
  try {
    globalShortcut.unregisterAll()
    killAllBrowserProcess()
    closeAllWindows()
    getTray()?.destroy()
    stopRoxynet()
    // 杀死整个进程组（包括 zygote、roxynet 等子进程）
    process.kill(-process.pid, 'SIGKILL')
  }
  catch (error) {
    console.error('cleanupAndExit error:', error)
  }
  finally {
    // 如果失败（比如不是进程组领导者），直接退出
    console.log('cleanupAndExit finally')
    app.exit(0)
  }
}
