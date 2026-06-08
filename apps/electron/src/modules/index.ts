import './ipc/receiver'
import { app } from 'electron'
import { appConfig } from '/@/constants'
import { isWindows } from '/@/constants/common'
import { intoLaunchPage } from '/@/modules/app/mainWindow'
// import * as Sentry from '@sentry/electron/main'
import { setupAppServer } from '/@/modules/appServer'
import { browserManager } from '/@/modules/browser'
import { killRoxynetZombieProcess, startRoxynet } from '/@/modules/roxynet'
import { initLocalConfig, restoreLastWindowOpenStatus, setupStore } from '/@/modules/store'
import { resourceUpdater } from '/@/modules/updater'
import { fileExists, killProcessByName } from '/@/utils'
import { setupApp } from './app/'

// Sentry.init({
//   dsn: import.meta.env.VITE_SENTRY_DSN,
// })

/**
 * Setup the modules.
 */
export async function setupModules() {
  // }
  try {
    // 启动时清理临时目录
    fileExists(appConfig.tempDir, true, true)
    // if (isPackaged) {
    await app.whenReady()
    // 初始化本地配置
    await initLocalConfig()
    // 启动 app 内置服务
    await setupAppServer()
    // 在任意逻辑拉起 roxynet 之前, 先清理上次异常退出残留的进程
    await killRoxynetZombieProcess()
    // 进入启动页
    await intoLaunchPage().finally(() => {
      if (isWindows) {
        killProcessByName('RoxyBrowserUpdater')
      }
    })
    // 设置 store
    await setupStore()
    // 启动 app
    await setupApp()
    // 启动资源更新器
    resourceUpdater.checkForUpdates()
  }
  catch (error) {
    console.error('setupModules', error)
  }
  finally {
    await startRoxynet().catch((error) => {
      console.error('startRoxynet error:', error)
    })
    restoreLastWindowOpenStatus()
    browserManager.autoClearByTimestamp()
  }
}
