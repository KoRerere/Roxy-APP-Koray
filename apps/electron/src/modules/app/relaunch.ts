import { app } from 'electron'

/** relaunch 时附带此参数，冷启动安装逻辑应跳过 pending 包安装 */
export const ROXY_SKIP_PENDING_UPDATE_ARG = '--roxy-skip-pending-update'

/** NSIS 安装/更新完成后由 installer.nsh StartApp 传入，标识安装器已拉起新版本 */
export const ROXY_UPDATED_ARG = '--updated'

/** 当前进程是否由托盘/主动重启拉起（携带 skip 标记） */
export function isSkipPendingUpdateLaunch(): boolean {
  return process.argv.includes(ROXY_SKIP_PENDING_UPDATE_ARG)
}

/** 当前进程是否由 NSIS 安装/更新完成后自动拉起 */
export function isPostUpdateLaunch(): boolean {
  return process.argv.includes(ROXY_UPDATED_ARG)
}

/** 重启应用；skipPendingUpdate 为 true 时新进程不会触发 Windows 冷启动 pending 安装 */
export function relaunchApp(options?: { skipPendingUpdate?: boolean }) {
  const args = process.argv.slice(1).filter(arg => arg !== ROXY_SKIP_PENDING_UPDATE_ARG)
  if (options?.skipPendingUpdate) {
    args.push(ROXY_SKIP_PENDING_UPDATE_ARG)
  }
  app.relaunch({ args, execPath: process.execPath })
  app.quit()
}
