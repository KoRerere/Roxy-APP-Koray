import { app, dialog, globalShortcut } from 'electron'
import { execFile, spawn } from 'node:child_process'
import { basename, dirname, join } from 'node:path'
import { API } from '/@/api'
import { appConfig } from '/@/constants'
import { isWindows } from '/@/constants/common'
import { getMainWindow } from '/@/modules/app/mainWindow'
import { getTray } from '/@/modules/app/tray'
import { stopRoxynet } from '/@/modules/roxynet'
import { forceSaveConfig, store } from '/@/modules/store'
import { appUpdater } from '/@/modules/updater'
import { getProcessIdsByExeDir, killProcessByName, killProcessForce } from '/@/utils'
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

/**
 * 退出所有浏览器进程, 防止有漏网之鱼
 *
 * - Windows: 按可执行文件名 `taskkill /F /IM`, 能命中所有 RoxyChrome 子进程, 同步触发但 `exec` 仍是异步的.
 * - macOS / Linux: 之前用 `pkill -f chrome_proxy / chromedriver` 是宽匹配, 会误杀用户本机其它 Chromium 系应用
 *   (Chrome / Edge / Arc 的 chrome_proxy helper) 以及其它 Selenium 项目的 chromedriver.
 *   现在改为基于 `appConfig.chromeBinDir / firefoxBinDir` 的"绝对路径前缀"精准匹配, 仅会清理 Roxy 自己解压出来的内核进程.
 *
 * 返回 `Promise<void>` 是为了让退出路径上的调用方可选 `await` 等待清理完成
 * (因为 macOS / Linux 路径上不再有 SIGKILL 兜底, 需要确保兜底杀进程真正完成再触发 `app.quit()`).
 * 不需要等待的调用方 (如启动期残留清理) 可以直接 fire-and-forget.
 */
export async function killAllBrowserProcess(): Promise<void> {
  if (isWindows) {
    killProcessByName('RoxyChrome')
    killProcessByName('RoxyFirefox')
    killProcessByName('chromedriver')
    killProcessByName('chrome_proxy')
    return
  }

  try {
    const targetDirs = [
      appConfig.chromeBinDir,
      appConfig.firefoxBinDir,
    ]
    const pidLists = await Promise.all(
      targetDirs.map(dir => getProcessIdsByExeDir(dir).catch((err) => {
        console.error(`getProcessIdsByExeDir error for ${dir}:`, err)
        return [] as number[]
      })),
    )
    const allPids = Array.from(new Set(pidLists.flat()))
    if (!allPids.length) {
      console.log('killAllBrowserProcess: no roxy browser process found')
      return
    }
    console.log(`killAllBrowserProcess: killing pids [${allPids.join(', ')}]`)
    const results = await Promise.allSettled(allPids.map(pid => killProcessForce(pid)))
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`killAllBrowserProcess: failed to kill pid ${allPids[i]}:`, r.reason)
      }
    })
  }
  catch (error) {
    console.error('killAllBrowserProcess error:', error)
  }
}

/** 是否正在显示卸载反馈窗口 */
let isShowingUninstallFeedback = false

/** 是否已确认退出 */
let isQuitConfirmed = false

/**
 * 显示卸载反馈窗口并等待用户操作
 */
export async function showUninstallFeedback(): Promise<void> {
  console.log('showUninstallFeedback called', isShowingUninstallFeedback, isQuitConfirmed)
  if (!store.token) {
    executeUninstall()
    return
  }

  console.log('showUninstallFeedback called', isShowingUninstallFeedback, isQuitConfirmed)
  if (isShowingUninstallFeedback || isQuitConfirmed) {
    return
  }

  isShowingUninstallFeedback = true

  try {
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
  console.log('User confirmed uninstall, exiting with code 0')
  // 先关窗口，避免触发 closed 后又走 cancelQuit（由 cancelQuit 的保护兜底）
  closeUninstallFeedbackWindow()
  executeUninstall()
}

let executeUninstalling = false
/** 执行卸载程序 */
export function executeUninstall() {
  console.log('executeUninstall called', executeUninstalling)
  if (executeUninstalling) {
    return
  }
  executeUninstalling = true

  const uninstallPath = join(
    dirname(app.getPath('exe')),
    `Uninstall ${basename(app.getPath('exe'))}`,
  )
  console.log('Executing uninstall at path:', uninstallPath)

  const child = spawn(uninstallPath, ['/roxy-force-uninstall'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })

  child.unref()
  app.exit(0)
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

  // 如果是卸载反馈模式，直接退出应用（用户取消卸载）
  if (isUninstallFeedbackMode) {
    isQuitConfirmed = true
    console.log('User cancelled uninstall, exiting app')
    app.exit(0)
    return
  }

  // 恢复主窗口（非卸载模式）
  const mainWindow = getMainWindow()
  if (mainWindow && !mainWindow.isDestroyed()) {
    return
  }
  // 如果主窗口不存在，退出应用
  console.log('No main window, exiting app')
  app.exit(0)
}

/**
 * 清理和释放资源, 让 APP 退出
 *
 * Windows: 走原有"硬退出"路径, `process.kill(-pid, SIGKILL)` 杀死整个进程组兜底, `app.exit(0)` 强退.
 *
 * macOS / Linux: **不再 SIGKILL 整个进程组**. 原因:
 *  1. macOS 上 `app.relaunch()` 通过 fork 一个等待父进程退出的中介子进程实现, 这个中介进程
 *     默认与主进程同 process group, 一旦 `kill -SIGKILL -pid` 会被一同干掉, 导致 `relaunch` 失效.
 *  2. Squirrel.Mac (ShipIt) 也可能作为子进程被一并杀死, 破坏自动更新流程.
 *  调用方应保证已经清理完业务资源 (closeAll / killAllBrowserProcess 等), 然后这里只做轻量收尾,
 *  把退出交还给 Electron 的正常生命周期 (由 `app.quit()` 重新驱动 `will-quit` / `quit`).
 */
export function cleanupAndExit() {
  try {
    stopRoxynet()
    globalShortcut.unregisterAll()
    killAllBrowserProcess()
    closeAllWindows()
    getTray()?.destroy()

    if (isWindows) {
      // 杀死整个进程组（包括 zygote、roxynet 等子进程）
      process.kill(-process.pid, 'SIGKILL')
    }
  }
  catch (error) {
    console.error('cleanupAndExit error:', error)
  }
  finally {
    console.log('cleanupAndExit finally')
    if (isWindows) {
      // Windows 上保留原有的硬退出兜底 (SIGKILL 若失败仍然能退)
      app.exit(0)
    }
    // macOS / Linux: 不再调用 app.exit(0), 让 Electron 走完正常 quit 生命周期,
    // 否则会绕过 `app.relaunch()` 的中介子进程, 也可能撕裂 Squirrel.Mac 的更新流程.
  }
}
