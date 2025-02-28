import { app, autoUpdater, crashReporter, globalShortcut, shell } from 'electron'
import path from 'node:path'
import { appProtocolName } from '/@/constants'
import { checkResource } from '/@/modules/app/checkResource'
import { createTray } from '/@/modules/app/tray'
import { killAllBrowserProcess } from '/@/modules/app/utils'
import { browserManager } from '/@/modules/browser'
import { ipcMain } from '/@/modules/ipc'
import { isMac, isWebReady, isWindows } from '/@/utils'
import { intoLaunchPage, intoMainPage, restoreOrCreateWindow } from './mainWindow'
import { appUpdater } from '/@/modules/updater'

// 获取 GPU 信息
// app.getGPUFeatureStatus()

// 开发环境下，使用开发环境变量中的版本号
if (!app.isPackaged) {
  app.getVersion = () => import.meta.env.VITE_APP_VERSION
}

// 设置主进程调试端口
// app.commandLine.appendSwitch('inspect', '9229');
// 设置渲染进程远程调试端口
// app.commandLine.appendSwitch('remote-debugging-port', '8315');
app.commandLine.appendSwitch('disable-renderer-accessibility')
// app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096')
app.commandLine.appendSwitch('--no-sandbox')

export async function setupApp() {
  /**
   * 防止多实例
   */
  const isSingleInstance = app.requestSingleInstanceLock()
  if (!isSingleInstance) {
    app.quit()
    process.exit(0)
  }

  app.removeAsDefaultProtocolClient(appProtocolName)
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(appProtocolName, process.execPath, [path.resolve(process.argv[1])])
    }
  }
  else {
    app.setAsDefaultProtocolClient(appProtocolName)
  }

  app.on('second-instance', async (event, commandLine) => {
    console.log('commandLine', commandLine)
    await restoreOrCreateWindow()
    await isWebReady()
    const searchParams = commandLine.at(-1)?.split('?')[1]
    // Windows 系统需要通过这种方式获取参数
    if (commandLine.at(-1)?.includes(`${appProtocolName}://oauth2callback`)) {
      console.log('oauth2callback: ', commandLine)
      ipcMain.send('oauth2:google-callback', `?${searchParams}`)
    }
    // Windows 系统需要通过这种方式获取参数
    if (commandLine.at(-1)?.includes(`${appProtocolName}://inviteUser2project`)) {
      console.log('inviteUser2project: ', commandLine)
      ipcMain.send('invite:to-project', `?${searchParams}`)
    }
  })

  // macOS 系统通过 open-url 事件获取参数
  app.on('open-url', async (event, url) => {
    console.log('open-url: ', url)
    const searchParams = url.split('?')[1]
    await isWebReady()
    if (url?.includes(`${appProtocolName}://oauth2callback`)) {
      ipcMain.send('oauth2:google-callback', `?${searchParams}`)
      console.log('oauth2callback: ', url)
    }
    if (url?.includes(`${appProtocolName}://inviteUser2project`)) {
      console.log('inviteUser2project: ', url)
      ipcMain.send('invite:to-project', `?${searchParams}`)
    }
  })

  //  系统自带浏览器打开
  app.on('web-contents-created', (e, webContents) => {
    webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: 'deny' }
    })
  })

  /**
   * Shout down background process if all windows was closed
   */
  // app.on('window-all-closed', () => {
  //   if (process.platform !== 'darwin') {
  //     console.log('All windows was closed. Quit app.')
  //     app.quit()
  //   }
  // })

  /**
   * @see https://www.electronjs.org/docs/v14-x-y/api/app#event-activate-macos Event: 'activate'
   */
  app.on('activate', restoreOrCreateWindow)

  /**
   * Create app window when background process will be ready
   */
  try {
    await app.whenReady()

    // 临时减少崩溃的问题：https://github.com/electron/electron/issues/39574
    app.setAccessibilitySupportEnabled(false)

    // 进入启动页
    await intoLaunchPage()
    // 检查资源是否准备完毕
    await checkResource()
    // 进入主页
    await intoMainPage()
    // 创建托盘
    createTray()
    console.log('setupApp done')
    // 初始化应用程序事件
    initAppEvent()

    setTimeout(() => {
      killAllBrowserProcess()
    })
  }
  catch (error) {
    console.error('Failed create window:', error)
  }
}

/** 初始化应用程序事件 */
function initAppEvent() {
  /** 是否由 autoUpdater.quitAndInstal() 退出应用程序 */
  let isQuittingForUpdate = false
  /** 是否已经在 APP 退出前同步过浏览器数据了 */
  let isSyncBrowserData = false

  autoUpdater.on('before-quit-for-update', () => {
    isQuittingForUpdate = true
    console.log('Application is quitting for update.')
  })

  app.on('before-quit', async (event) => {
    if (!isSyncBrowserData) {
      event.preventDefault()
      try {
        // 关闭所有浏览器进程，并同步数据
        await browserManager.closeAll()
        console.log('Application is quitting normally.')
      }
      catch (error) {
        console.error('browserManager.closeAll error:', error)
      }
      finally {
        console.log('Application is quitting finally.')
        globalShortcut.unregisterAll()
        // 退出所有浏览器进程, 防止有漏网之鱼
        killAllBrowserProcess()
      }
    }

    if (isQuittingForUpdate) {
      console.log('Application is quitting for update.')
      if (!isSyncBrowserData) {
        isSyncBrowserData = true
        appUpdater.upgradeNow()
      }
    }
    else {
      // 立即退出应用程序,所有窗口都将立即被关闭，而不询问用户，而且 before-quit 和 will-quit 事件也不会被触发。
      app.exit()
    }
  })
}
