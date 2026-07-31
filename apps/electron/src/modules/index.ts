import './ipc/receiver'
import { app } from 'electron'
import { appConfig } from '/@/constants'
import { isWindows } from '/@/constants/common'
// import * as Sentry from '@sentry/electron/main'
import { setupAppServer } from '/@/modules/appServer'
import { browserManager } from '/@/modules/browser'
import { killRoxynetZombieProcess, startRoxynet } from '/@/modules/roxynet'
import { initLocalConfig, restoreLastWindowOpenStatus, setupStore } from '/@/modules/store'
import { appUpdater, ensureBinSeeds, resourceUpdater, startBinUpdaters, triggerFirstBinCheck } from '/@/modules/updater'
import { fileExists, initCrypto, killProcessByName } from '/@/utils'
import { setupApp } from './app/'

// Sentry.init({
//   dsn: import.meta.env.VITE_SENTRY_DSN,
// })

/**
 * Setup the modules.
 */
export async function setupModules() {
  fileExists(appConfig.tempDir, true, true)

  await app.whenReady()
  await initCrypto()
  await initLocalConfig()

  if (await appUpdater.tryInstallPendingUpdateOnLaunch()) {
    return
  }

  try {
    // 启动 app 内置服务
    await setupAppServer()
    // 在任意逻辑拉起 roxynet 之前, 先清理上次异常退出残留的进程
    await killRoxynetZombieProcess()
    // 清理上次更新遗留的 RoxyBrowserUpdater 进程（资源已改为后台异步更新，不再展示启动页）
    if (isWindows) {
      killProcessByName('RoxyBrowserUpdater')
    }
    // 设置 store
    await setupStore()
    // 启动 app
    await setupApp()
    // 启动资源更新器
    resourceUpdater.checkForUpdates()
    // 启动 roxynet / roxysync 后台更新器（定时检查 + 空闲 apply）
    startBinUpdaters()
  }
  catch (error) {
    console.error('setupModules', error)
  }
  finally {
    // 启动 roxynet 前先做本地 seed 自愈（快速、不联网），保证 active 可用
    await ensureBinSeeds().catch((error) => {
      console.error('ensureBinSeeds error:', error)
    })
    await startRoxynet().catch((error) => {
      console.error('startRoxynet error:', error)
    })
    // active 已就绪、roxynet 已启动后再触发首检，避免与自愈/启动的竞态
    triggerFirstBinCheck()
    restoreLastWindowOpenStatus()
    browserManager.autoClearByTimestamp()
  }
}
