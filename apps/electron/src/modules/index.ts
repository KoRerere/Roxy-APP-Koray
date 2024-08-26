import './ipc'
import { setupApp } from './app/'
import { openAPIServer } from '/@/modules/openapi'
import { setupStore } from '/@/modules/store'
import { isProd } from '/@/utils'
import { setupLog } from '/@/modules/log'

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
