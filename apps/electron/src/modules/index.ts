import { setupIpc } from './ipc'
import { setupApp } from './app'

/**
 * Setup the modules.
 */
export function setupModules() {
  // setupLog()
  setupIpc()
  setupApp()
}
