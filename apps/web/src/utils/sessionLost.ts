/**
 * 掉登录态后的强制升级时机管理。
 *
 * 流程：403/405 时记录失效时间 → 满 1 小时且用户回到 APP → 弹出强制升级弹窗。
 * 仅存 sessionStorage，随窗口会话结束而清除，不写主进程配置。
 */
import { isDev } from '/@/utils'

/** sessionStorage 键名 */
const SESSION_LOST_AT_KEY = 'roxy:sessionLostAt'

/** 掉登录态后，需等待多久才可在回到 APP 时触发强制升级（开发环境缩短便于调试） */
export const SESSION_LOST_UPGRADE_DELAY_MS = isDev ? 2 * 60 * 1000 : 60 * 60 * 1000

/**
 * 记录首次掉登录态时间（403/405 时调用）。
 * 若已有记录则不再覆盖，避免定时/轮询请求反复 403 导致计时被重置。
 */
export function markSessionLost() {
  if (getSessionLostAt())
    return

  sessionStorage.setItem(SESSION_LOST_AT_KEY, String(Date.now()))
}

/** 清除记录：登录成功，或已展示过强制升级弹窗 */
export function clearSessionLost() {
  sessionStorage.removeItem(SESSION_LOST_AT_KEY)
}

function getSessionLostAt(): number {
  const value = sessionStorage.getItem(SESSION_LOST_AT_KEY)
  return value ? Number(value) : 0
}

/** 是否已满等待时长（未满 1 小时时不弹窗，即使用户聚焦或操作页面） */
export function isSessionLostOverDelay(): boolean {
  const sessionLostAt = getSessionLostAt()
  return Boolean(sessionLostAt && Date.now() - sessionLostAt >= SESSION_LOST_UPGRADE_DELAY_MS)
}
