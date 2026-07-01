import { autoSaveConfig } from '/@/modules/store/util'
import { store } from '/@/modules/store'

export type NetworkMode = 'local' | 'system' | 'custom'

/** 读取内核网络模式；缺失时由废弃字段 systemProxySwitch 兼容 */
export function getNetworkMode(): NetworkMode {
  if (store.networkMode) {
    return store.networkMode
  }
  if (store.systemProxySwitch === false) {
    return 'local'
  }
  return 'system'
}

/** 是否经 roxynet 走系统代理（system / custom 为 true，local 为 false） */
export function isKernelSystemProxyEnabled(): boolean {
  const mode = getNetworkMode()
  return mode === 'system' || mode === 'custom'
}

/** 内核自定义代理是否已配置（networkMode 为 custom 时使用） */
export function isKernelCustomProxyConfigured(): boolean {
  const host = store.proxyHost?.trim()
  const port = Number(store.proxyPort)
  return Boolean(host) && port >= 1 && port <= 65535
}

/** roxynet 上游代理是否可用（同步判断，system 模式依赖已缓存的系统代理地址） */
export function isRoxynetUpstreamReady(systemProxyAddress?: string): boolean {
  const mode = getNetworkMode()
  if (mode === 'local' || !isKernelSystemProxyEnabled()) {
    return false
  }
  if (mode === 'custom') {
    return isKernelCustomProxyConfigured()
  }
  return Boolean(systemProxyAddress?.trim())
}

/** 从废弃字段 systemProxySwitch 迁移 networkMode（保留 systemProxySwitch 不删除） */
export function migrateNetworkModeFromLegacy(persisted: Record<string, unknown>) {
  if (!('networkMode' in persisted)) {
    store.networkMode = store.systemProxySwitch === false ? 'local' : 'system'
    autoSaveConfig()
  }
}
