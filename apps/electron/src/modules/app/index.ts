import path from 'node:path'
import { app, shell } from 'electron'
import { restoreOrCreateWindow } from './mainWindow'
import { ipcMain } from '/@/modules/ipc'

app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096')
app.commandLine.appendSwitch('--no-sandbox')

// 捕获未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error)
  // 在这里执行一些清理操作或记录错误日志
})

// 捕获未处理的 Promise 拒绝
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason)
  // 在这里执行一些清理操作或记录错误日志
})

export function setupApp() {
  /**
   * 防止多实例
   */
  const isSingleInstance = app.requestSingleInstanceLock()
  if (!isSingleInstance) {
    app.quit()
    process.exit(0)
  }

  const protocolName = 'roxybrowser'

  app.removeAsDefaultProtocolClient(protocolName)
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(protocolName, process.execPath, [path.resolve(process.argv[1])])
    }
  }
  else {
    app.setAsDefaultProtocolClient(protocolName)
  }

  app.on('second-instance', async (event, commandLine) => {
    console.log('commandLine', commandLine)
    await restoreOrCreateWindow()
    if (commandLine.at(-1)?.includes(`${protocolName}://oauth2callback`)) {
      console.log('oauth2callback: ', commandLine)
      ipcMain.send('oauth2:google-callback', `?${commandLine.at(-1)?.split('?')[1]}`)
    }
  })

  app.on('open-url', (event, url) => {
    ipcMain.send('oauth2:google-callback', `?${url.split('?')[1]}`)
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
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  /**
   * @see https://www.electronjs.org/docs/v14-x-y/api/app#event-activate-macos Event: 'activate'
   */
  app.on('activate', restoreOrCreateWindow)

  /**
   * Create app window when background process will be ready
   */
  app.whenReady()
    .then(restoreOrCreateWindow)
    .catch(e => console.error('Failed create window:', e))
}
