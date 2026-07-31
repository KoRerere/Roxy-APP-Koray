import { store } from '/@/modules/store'
import { autoSaveConfig } from '/@/modules/store/util'

/** 是否启用客户端自动更新；Windows 为冷启动安装，非 Windows 为退出时静默安装 */
export function getAutoUpdateAppOnLaunch(): boolean {
  if (store.autoUpdateAppOnLaunch !== undefined) {
    return store.autoUpdateAppOnLaunch
  }
  if (store.autoUpdateApp !== undefined) {
    return store.autoUpdateApp
  }
  return true
}

/** 旧版 autoUpdateApp 一次性迁移到新字段 */
export function migrateAutoUpdateAppOnLaunchFromLegacy(persisted: Record<string, unknown>) {
  if (!('autoUpdateAppOnLaunch' in persisted) && typeof persisted.autoUpdateApp === 'boolean') {
    store.autoUpdateAppOnLaunch = persisted.autoUpdateApp
    autoSaveConfig()
  }
}
