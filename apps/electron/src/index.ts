import './catchException'
import './polyfill'
import './locales/'
import { app } from 'electron'
import { initDebug } from '/@/debug'
import { setupModules } from '/@/modules/'
import { getUninstallFeedbackWindow, isUninstallFeedbackMode } from '/@/modules/app/uninstallFeedback'
import { executeUninstall, killAllBrowserProcess, showUninstallFeedback } from '/@/modules/app/utils'
import { setupAppServer } from '/@/modules/appServer'
import { setupLog } from '/@/modules/log'
import { initLocalConfig, store } from '/@/modules/store'

/**
 * 防止多实例
 */
const isSingleInstance = app.requestSingleInstanceLock()
if (!isSingleInstance) {
  // 如果是卸载反馈模式且已有实例运行，第二个实例直接退出
  // 已运行的实例会收到 second-instance 事件并显示卸载窗口
  console.log('Another instance is already running, quitting...')
  app.quit()
  process.exit(0)
}

// 设置日志
setupLog()
console.log(`App starting in ${isUninstallFeedbackMode ? 'uninstall feedback' : 'normal'} mode`)
console.log(`isSingleInstance: ${isSingleInstance}`)

app.whenReady().then(async () => {
  console.log('App is ready')

  // 检查是否是卸载反馈模式
  if (isUninstallFeedbackMode) {
    console.log('Uninstall feedback mode detected')
    // 如果是首次启动，需要初始化本地配置和启动 APP 内置 Web 服务
    if (isSingleInstance && !getUninstallFeedbackWindow()) {
      try {
        // 初始化本地配置
        await initLocalConfig()
        // 启动 APP 内置 Web 服务
        await setupAppServer()
        if (!store.token && !store.lastUserId) {
          executeUninstall()
          return
        }
      }
      catch (error) {
        console.error('[UninstallFeedback] init failed:', error)
      }
    }
    if (!store.token && !store.lastUserId) {
      executeUninstall()
      return
    }
    console.log('queueMicrotask showUninstallFeedback')
    // 直接显示卸载反馈窗口
    showUninstallFeedback()
    initDebug()
  }
  else {
    setTimeout(() => {
      killAllBrowserProcess()
    })
    setupModules().finally(initDebug)
  }
}).catch((error) => {
  console.error('App initialization failed:', error)
})
