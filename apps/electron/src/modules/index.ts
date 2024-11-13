import './ipc'
import * as Sentry from '@sentry/electron/main'
import { setupAppServer } from '/@/modules/appServer'
import { setupLog } from '/@/modules/log'
import { startLuminet } from '/@/modules/roxynet'
import { setupStore } from '/@/modules/store'
import { setupApp } from './app/'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
})

/**
 * Setup the modules.
 */
export async function setupModules() {
  // if (isPackaged) {
  // 设置日志
  setupLog()
  // }
  try {
    // 设置 store
    await setupStore()
    // 启动 app 内置服务
    await setupAppServer()
    // 启动 app
    await setupApp().finally(async () => {
      // 启动 luminet 服务
      startLuminet()
    })
  }
  catch (error) {
    console.error('setupModules', error)
  }
}
