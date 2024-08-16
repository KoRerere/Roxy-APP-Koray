import { setupIpc } from './ipc'
import { setupLog } from './log'
import { setupApp } from './app'

/**
 * Setup the modules.
 */
export function setupModules() {
  setupLog()
  setupIpc()
  setupApp()
}
