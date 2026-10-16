import { useLocalStorage } from '@vueuse/core'
import { startOfTomorrow } from 'date-fns'

/** 两个页面共用的冷却时长 */
const COOLDOWN_MS = 30 * 60 * 1000
const SILENCE_KEY = 'proxy-expire-remind-silence'
/** 登录页写入、主布局读取，两次 setup 不共享 ref，所以直接用 sessionStorage */
const LOGIN_KEY = 'proxy-expire-remind:login'
/** 进程退出后 sessionStorage 会清空，用来区分本次启动和同一次进程里的页面切换 */
const RESTART_KEY = 'proxy-expire-remind:restart-handled'

interface SilenceRecord {
  /** 今日不再提醒的截止时间（本地次日 0 点） */
  dismissUntil?: number
  /** 暂不处理之后，两个页面共用的冷却截止时间 */
  cooldownUntil?: number
}

/** 本次登录进入主界面后，下一次判断跳过 30 分钟冷却 */
export function markProxyExpireRemindLogin() {
  sessionStorage.setItem(LOGIN_KEY, '1')
}

/** 登录豁免还在不在。确认完成前不能先删，否则请求被取消或窗口页拦住时，这次登录就丢了 */
export function hasProxyExpireRemindLogin() {
  return sessionStorage.getItem(LOGIN_KEY) === '1'
}

/** 消费登录豁免。数量为 0 或今日不再提醒已生效时也要消费，避免稍后被当成新的一次登录 */
export function consumeProxyExpireRemindLogin() {
  if (sessionStorage.getItem(LOGIN_KEY) !== '1') {
    return false
  }
  sessionStorage.removeItem(LOGIN_KEY)
  return true
}

export function hasHandledProxyExpireRemindRestart() {
  return sessionStorage.getItem(RESTART_KEY) === '1'
}

/** 本次进程的重启豁免只使用一次 */
export function markProxyExpireRemindRestartHandled() {
  sessionStorage.setItem(RESTART_KEY, '1')
}

/** 按用户记住静默截止时间。必须在组件 setup 里调用 */
export function useProxyExpireRemindSilence() {
  const silence = useLocalStorage<Record<string, SilenceRecord>>(SILENCE_KEY, {})

  function read(userId: number): SilenceRecord {
    return silence.value[String(userId)] ?? {}
  }

  function write(userId: number, record: SilenceRecord) {
    silence.value = {
      ...silence.value,
      [String(userId)]: record,
    }
  }

  function isDismissedToday(userId: number) {
    const until = read(userId).dismissUntil
    return typeof until === 'number' && Date.now() < until
  }

  function isCoolingDown(userId: number) {
    const until = read(userId).cooldownUntil
    return typeof until === 'number' && Date.now() < until
  }

  /** 勾选记到本地次日 0 点；取消勾选则清除，不改冷却 */
  function setDismissToday(userId: number, checked: boolean) {
    const current = { ...read(userId) }
    if (checked) {
      current.dismissUntil = startOfTomorrow(new Date()).getTime()
    }
    else {
      delete current.dismissUntil
    }
    write(userId, current)
  }

  function startCooldown(userId: number) {
    write(userId, {
      ...read(userId),
      cooldownUntil: Date.now() + COOLDOWN_MS,
    })
  }

  return {
    isDismissedToday,
    isCoolingDown,
    setDismissToday,
    startCooldown,
  }
}
