import './catchException'
import './polyfill'
import './locales/'
import { app } from 'electron'
import { initDebug } from '/@/debug'
import { setupModules } from '/@/modules/'
import { killAllBrowserProcess } from '/@/modules/app/utils'

/**
 * 防止多实例
 */
const isSingleInstance = app.requestSingleInstanceLock()
if (!isSingleInstance) {
  app.quit()
  process.exit(0)
}

setTimeout(() => {
  killAllBrowserProcess()
})

setupModules().finally(initDebug)
