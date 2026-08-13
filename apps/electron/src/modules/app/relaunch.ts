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

/** 重启应用的可选项 */
interface RelaunchAppOptions {
  /** 为 true 时新进程不会触发 Windows 冷启动 pending 安装 */
  skipPendingUpdate?: boolean
  /**
   * 放到 argv 最前面的参数。
   *
   * Node CLI flag（如 --experimental-network-inspection）只在进程启动时被解析，
   * 且需要出现在应用入口路径之前才稳定生效，因此单独前置拼接。
   */
  leadingArgs?: string[]
  /**
   * 需要从原 argv 中剔除的参数（支持 `--foo` 与 `--foo=value` 两种形式）。
   *
   * 调用方应把 leadingArgs 里的参数名一并传入，避免反复重启后参数不断堆积。
   */
  dropArgPrefixes?: string[]
}

/** 重启应用 */
export function relaunchApp(options?: RelaunchAppOptions) {
  const dropPrefixes = [ROXY_SKIP_PENDING_UPDATE_ARG, ...(options?.dropArgPrefixes ?? [])]
  const args = process.argv.slice(1).filter(arg => !dropPrefixes.some(prefix => arg === prefix || arg.startsWith(`${prefix}=`)))
  if (options?.skipPendingUpdate) {
    args.push(ROXY_SKIP_PENDING_UPDATE_ARG)
  }
  app.relaunch({ args: [...(options?.leadingArgs ?? []), ...args], execPath: process.execPath })
  app.quit()
}
