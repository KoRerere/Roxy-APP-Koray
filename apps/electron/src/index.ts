import './catchException'
import './polyfill'
import './locales/'
import { app } from 'electron'
import { initDebug } from '/@/debug'
import { setupModules } from '/@/modules/'
import { isUninstallFeedbackMode } from '/@/modules/app/uninstallFeedback'
import { killAllBrowserProcess, showUninstallFeedback } from '/@/modules/app/utils'
import { setupAppServer } from '/@/modules/appServer'
import { initLocalConfig, setupStore } from '/@/modules/store'

/**
 * 防止多实例（卸载反馈模式除外）
 */
const isSingleInstance = app.requestSingleInstanceLock()
if (!isSingleInstance && !isUninstallFeedbackMode) {
  app.quit()
  process.exit(0)
}

// 检查是否是卸载反馈模式
if (isUninstallFeedbackMode) {
  console.log('Uninstall feedback mode detected')
  queueMicrotask(async () => {
    // 如果是首次启动，需要初始化本地配置和启动 APP 内置 Web 服务
    if (isSingleInstance) {
      try {
      // 初始化本地配置
        await initLocalConfig()
        await setupStore()
        // 启动 APP 内置 Web 服务（打包环境下 webBaseUrl 依赖它）
        await setupAppServer()
      }
      catch (error) {
        console.error('[UninstallFeedback] init failed:', error)
      }
      await app.whenReady()
    }
    // 直接显示卸载反馈窗口
    showUninstallFeedback()
    initDebug()
  })
}
else {
  setTimeout(() => {
    killAllBrowserProcess()
  })

  setupModules().finally(initDebug)
}
