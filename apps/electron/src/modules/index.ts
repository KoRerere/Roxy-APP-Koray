import './ipc'
// import * as Sentry from '@sentry/electron/main'
import { setupAppServer } from '/@/modules/appServer'
import { setupLog } from '/@/modules/log'
import { startRoxynet } from '/@/modules/roxynet'
import { setupStore } from '/@/modules/store'
import { setupApp } from './app/'
import { fileExists } from '/@/utils'
import { appConfig } from '/@/constants'

// Sentry.init({
//   dsn: import.meta.env.VITE_SENTRY_DSN,
// })

/**
 * Setup the modules.
 */
export async function setupModules() {
  // 启动时清理临时目录
  fileExists(appConfig.tempDir, true, true)
  // if (isPackaged) {
  // 设置日志
  setupLog()
  // }
  try {
    // 设置 store
    await setupStore()
    // 启动 app 内置服务
    await setupAppServer()
    // 启动 roxynet 服务
    startRoxynet()
    // 启动 app
    await setupApp()
  }
  catch (error) {
    console.error('setupModules', error)
  }
}
