import { isNewerOrEqualVersion } from './common'

/** 当前客户端是否 ≥ v3.8.8（Firefox 内核、Skills 商城、MCP 积分等） */
export function supportsApp3_8_8() {
  return isNewerOrEqualVersion('3.8.8')
}

/** 当前客户端是否 ≥ v4.0.0（启动时自动安装 pending 包配置存本地、user:uploadOssFile IPC、app:ensureBrowserCacheRootDir IPC、app:browser-cache-root-dir-fallback 事件） */
export function supportsApp4_0_0() {
  return isNewerOrEqualVersion('4.0.0')
}

/**
 * 是否启用自动化脚本库与录制入口。
 * Electron 端由主进程 env ENABLE_SCRIPT_RECORDING=yes 控制；
 */
export function isScriptRecordingEnabled(): boolean {
  return Boolean(globalThis?.$featureFlags?.scriptRecording)
}
