import './ipc'
import { setupLog } from '/@/modules/log'
import { setupOpenAPIServer } from '/@/modules/openapi'
import { setupStaticServer } from '/@/modules/staticServer'
import { setupStore } from '/@/modules/store'
import { isPackaged } from '/@/utils'
import { setupApp } from './app/'

/**
 * Setup the modules.
 */
export async function setupModules() {
  if (isPackaged) {
    setupLog()
  }
  await setupStore()
  setupApp()
  setupOpenAPIServer()
  setupStaticServer()
}
