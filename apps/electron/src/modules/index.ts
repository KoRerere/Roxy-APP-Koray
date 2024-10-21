import './ipc'
import { setupAppServer } from '/@/modules/appServer'
import { setupLog } from '/@/modules/log'
import { startLuminet } from '/@/modules/luminet'
import { setupOpenAPIServer } from '/@/modules/openapi'
import { setupStore } from '/@/modules/store'
import { isPackaged } from '/@/utils'
import { setupApp } from './app/'

/**
 * Setup the modules.
 */
export async function setupModules() {
  if (isPackaged) {
    // 设置日志
    setupLog()
  }
  // 设置 store
  await setupStore()
  // 启动 app
  await setupApp()
  // 启动 openapi 服务
  setupOpenAPIServer()
  // 启动 app 内置服务
  await setupAppServer()
  // 启动 luminet 服务
  startLuminet()
}
