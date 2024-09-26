import './ipc'
import { setupLog } from '/@/modules/log'
import { openAPIServer } from '/@/modules/openapi'
import { setupStore } from '/@/modules/store'
import { isProd } from '/@/utils'
import { setupApp } from './app/'

/**
 * Setup the modules.
 */
export async function setupModules() {
  if (isProd) {
    setupLog()
  }
  await setupStore()
  setupApp()
  openAPIServer.start()
}
