import './catchException'
import './polyfill'
import './locales/'
import { setupModules } from '/@/modules/'
import { initDebug } from '/@/debug'
import { app } from 'electron'

/**
 * 防止多实例
 */
const isSingleInstance = app.requestSingleInstanceLock()
if (!isSingleInstance) {
  app.quit()
  process.exit(0)
}

setupModules().finally(initDebug)
