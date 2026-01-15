import './ipc/receiver'
import { app } from 'electron'
import { appConfig } from '/@/constants'
import { intoLaunchPage } from '/@/modules/app/mainWindow'
// import * as Sentry from '@sentry/electron/main'
import { setupAppServer } from '/@/modules/appServer'
import { browserManager } from '/@/modules/browser'
import { setupLog } from '/@/modules/log'
import { startRoxynet } from '/@/modules/roxynet'
import { initLocalConfig, setupStore } from '/@/modules/store'
import { resourceUpdater } from '/@/modules/updater'
import { fileExists } from '/@/utils'
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
    // 设置日志
    setupLog()
    await app.whenReady()
    // 初始化本地配置
    await initLocalConfig()
    // 启动 app 内置服务
    await setupAppServer()
    // 进入启动页
    await intoLaunchPage()
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
    // 启动 roxynet 服务
    startRoxynet()
    browserManager.autoClearByTimestamp()
  }
}
