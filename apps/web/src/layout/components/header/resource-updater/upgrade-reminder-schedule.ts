/** 强制更新间隔提醒覆盖的时长（从就绪时刻起算） */
export const FORCE_UPGRADE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

/** 强制更新两次间隔提醒的最小间隔；错过的间隔不补弹 */
export const FORCE_UPGRADE_INTERVAL_MS = 8 * 60 * 60 * 1000

/** 本次是否应弹出更新公告，以及原因 */
export type UpgradeReminderReason = 'launch' | 'slot'

/** 解析提醒所需的已持久化状态（不含 I/O） */
export interface UpgradeReminderDecisionInput {
  /** 是否为服务端标记的强制更新 */
  isForceUpgrade: boolean
  /** 当前 Electron 会话是否已因启动弹出过 */
  launchShown: boolean
  /** 强制更新就绪时刻（Unix ms） */
  startAt?: number
  /** 上次实际弹出时刻（Unix ms）；长时间未打开只按这一次间隔判断，不回放错过的点 */
  lastShownAt?: number
  /** 用于计算间隔；缺省为现在 */
  now?: Date
}

/** 强制更新间隔提醒是否仍在就绪后的 3 天窗口内 */
export function isWithinForceWindow(startAt: number, now: number, windowMs = FORCE_UPGRADE_WINDOW_MS): boolean {
  const elapsed = now - startAt
  return elapsed >= 0 && elapsed < windowMs
}

/**
 * 距上次弹出是否已满 8 小时。从未弹过则视为到期，避免把错过的 8h 点一次性补上。
 */
export function isForceIntervalDue(
  lastShownAt: number | undefined,
  now: number,
  intervalMs = FORCE_UPGRADE_INTERVAL_MS,
): boolean {
  if (lastShownAt == null) {
    return true
  }
  return now - lastShownAt >= intervalMs
}

/**
 * 启动必弹一次；强制更新在就绪后 3 天内，按上次弹出再隔 8 小时补弹。
 * 启动弹窗会记下 lastShownAt，避免同一时刻再走间隔弹窗。
 */
export function resolveAppUpgradeReminderReason(
  input: UpgradeReminderDecisionInput,
): UpgradeReminderReason | null {
  const now = (input.now ?? new Date()).getTime()

  if (!input.launchShown) {
    return 'launch'
  }

  if (!input.isForceUpgrade) {
    return null
  }

  const startAt = input.startAt ?? now
  if (!isWithinForceWindow(startAt, now)) {
    return null
  }
  if (!isForceIntervalDue(input.lastShownAt, now)) {
    return null
  }
  return 'slot'
}
