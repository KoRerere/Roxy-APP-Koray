import type { UseDialogInstance } from '/@/hooks/useDialog'
import ActivityModal from '/@/views/campaign/new-user/activity-modal.vue'
import { useDialog } from '/@/hooks/useDialog'
import { useNewUserBenefitStore } from '/@/stores/new-user-benefit'
import { useUserStore } from '/@/stores/user'
import { useProxy } from '/@/views/agent/hooks'
import { enhanceCountdown, safeParseJSON } from '/@/utils/basic'
import { emitter } from '/@/utils/eventBus'
import { SubLevelEnum } from '/@/enums/pay'

const LOCAL_STORAGE_KEY = '$NewUserBenefitModal'
/** 自动再弹间隔：8 小时 */
const REOPEN_INTERVAL_MS = 1000 * 60 * 60 * 8
/** 同一自然日自动弹出上限 */
const MAX_AUTO_OPENS_PER_DAY = 3
const nextOpenStorageKey = `${LOCAL_STORAGE_KEY}:nextOpen`
const dailyStorageKey = `${LOCAL_STORAGE_KEY}:daily`
/** 本次登录待自动弹出（session，登出后标签页仍可能残留，登录时会重新写入） */
const showOnLoginKey = `${LOCAL_STORAGE_KEY}:showOnLogin`
/**
 * 本次 APP 会话是否已自动弹出过（对齐充值福利月：sessionStorage，进程退出后清空，下次启动再弹一次）
 */
const sessionShownKey = `${LOCAL_STORAGE_KEY}:sessionShown`
/** 活动买三送一对应的实付天数，入口默认选中该档 */
const WINDOW_SUBSCRIBE_DEFAULT_DAYS = 90

/** 登录成功后打标，主界面首次 requestModal 会忽略间隔与当日次数弹一次 */
export function markNewUserBenefitShowOnLogin() {
  sessionStorage.setItem(showOnLoginKey, '1')
}

/** 消费登录待弹标记，避免同一次登录重复自动弹出 */
function consumeShowOnLogin() {
  if (sessionStorage.getItem(showOnLoginKey) !== '1') {
    return false
  }
  sessionStorage.removeItem(showOnLoginKey)
  return true
}

/**
 * 本次 APP 启动尚未自动弹过则消费并返回 true。
 * 与登录标记分开：已登录用户重启客户端不会走登录页，但仍应弹一次。
 */
function consumeShowOnAppStart() {
  if (sessionStorage.getItem(sessionShownKey) === '1') {
    return false
  }
  sessionStorage.setItem(sessionShownKey, '1')
  return true
}

/** 多入口共用同一弹窗实例，避免侧栏与钱包卡叠两层 */
let dialogInstance: UseDialogInstance | undefined
/** showModal 返回前、hide 动画结束前都视为占用，避免同 tick 重挂再 new 一层 */
let isShowing = false
let openedByForce = false
let activityCountdown: ReturnType<typeof enhanceCountdown> | undefined
/** 资格失效的关闭逻辑不能绑在某个入口组件上，否则侧栏卸载后 watch 会一起没掉 */
let visibilityScope: ReturnType<typeof effectScope> | undefined
/** 侧栏 v-if 闪断时取消尚未执行的关闭，避免先关后弹 */
let disposeTimer: ReturnType<typeof setTimeout> | undefined

/** 释放全局实例锁；hide 晚到时不要清掉已经打开的新实例 */
function releaseDialogInstance(instance?: UseDialogInstance) {
  if (instance && dialogInstance && instance !== dialogInstance) {
    return
  }
  dialogInstance = undefined
  isShowing = false
  openedByForce = false
}

/** 活动结束或资格失效时关掉弹窗并停止 8 小时排程 */
function closeModalAndSchedule() {
  activityCountdown?.stop()
  activityCountdown = undefined
  const instance = dialogInstance
  if (!instance) {
    releaseDialogInstance()
    return
  }
  // PrimeVue 离场时 dialogMap 已删 header，立刻放锁会让重挂的 requestModal 再挂一层
  void instance.hideModal().finally(() => {
    releaseDialogInstance(instance)
  })
}

/** 资格失效时关掉全局弹窗；用独立 effectScope，不随某个入口组件卸载而失效 */
function ensureVisibilityWatch() {
  if (visibilityScope) {
    return
  }
  visibilityScope = effectScope(true)
  visibilityScope.run(() => {
    const { visible } = storeToRefs(useNewUserBenefitStore())
    watch(visible, (isVisible) => {
      if (!isVisible) {
        closeModalAndSchedule()
      }
    })
  })
}

/** 取消侧栏卸载时尚未执行的关闭 */
function cancelPendingDispose() {
  if (disposeTimer === undefined) {
    return
  }
  clearTimeout(disposeTimer)
  disposeTimer = undefined
}

/**
 * 自动弹出当下写入 8 小时间隔。
 * 过期的 nextOpen 必须覆盖：登录/启动绕过间隔弹完后，关窗不能把过期 key 当成「立刻再弹」。
 * 未到期的排程保留，避免登录多弹的那一次把下次自动弹出无谓推迟。
 */
function ensureAutoOpenInterval() {
  const stored = Number(localStorage.getItem(nextOpenStorageKey))
  if (Number.isFinite(stored) && stored > Date.now()) {
    return
  }
  localStorage.setItem(nextOpenStorageKey, String(Date.now() + REOPEN_INTERVAL_MS))
}

/**
 * 新人福利弹窗：侧栏自动弹出 + 各入口强制打开共用同一套排程。
 * 强制打开（点卡片/侧栏）不计入每日 3 次、不重排 8 小时。
 * 每次登录、每次 APP 启动额外自动弹一次，不受 8 小时与当日次数限制。
 */
export function useNewUserBenefitModal() {
  const router = useRouter()
  const { userPayInfo } = storeToRefs(useUserStore())
  const { visible } = storeToRefs(useNewUserBenefitStore())
  const { buyProxy } = useProxy()
  const [showModal] = useDialog()
  ensureVisibilityWatch()

  /** 自然日 YYYY-MM-DD，用于跨重启累计当天自动弹出次数 */
  function todayKey() {
    const date = new Date()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${date.getFullYear()}-${month}-${day}`
  }

  /** 读取当日自动弹出计数；跨日后自动归零 */
  function readDailyState() {
    const raw = safeParseJSON(localStorage.getItem(dailyStorageKey)) as { date?: string, count?: number } | null
    if (!raw || raw.date !== todayKey()) {
      return { date: todayKey(), count: 0 }
    }
    return { date: raw.date, count: Number(raw.count) || 0 }
  }

  /** 把当日自动弹出次数写回 localStorage */
  function writeDailyState(count: number) {
    localStorage.setItem(dailyStorageKey, JSON.stringify({ date: todayKey(), count }))
  }

  /** 是否还能自动弹出（自然日未满 3 次） */
  function canAutoOpen() {
    return readDailyState().count < MAX_AUTO_OPENS_PER_DAY
  }

  /** 累计一次自动弹出（仅自动关闭路径调用） */
  function markAutoShown() {
    const state = readDailyState()
    writeDailyState(state.count + 1)
  }

  /** 关闭收尾：强制打开不计次；自动打开则记次并排 8 小时后再弹 */
  function onDismiss() {
    const wasForce = openedByForce
    const instance = dialogInstance
    const hadDialog = !!instance || isShowing
    releaseDialogInstance(instance)
    // hideModal 与 handleCancel 可能各走一次，避免重复计数
    if (!hadDialog) {
      return
    }
    if (wasForce) {
      return
    }
    markAutoShown()
    scheduleReopen()
  }

  /**
   * 请求弹出。force 为入口点击，忽略间隔与当日次数。
   * 登录后与 APP 启动首次自动弹出同样不受间隔/次数限制；其余自动弹出需当日未满 3 次且已过下次弹出时间。
   * 已有全局实例（含关闭动画中）时直接返回，避免连弹或叠层。
   */
  function requestModal(force = false) {
    cancelPendingDispose()
    if (!visible.value || dialogInstance || isShowing) {
      return
    }

    if (force) {
      openedByForce = true
      openActivityModal()
      return
    }

    // 本次登录 / 本次 APP 启动尚未自动弹过：不受 8 小时与当日 3 次限制
    // 两个 consume 都要执行，避免只走登录分支时漏打 session 标，同会话内再弹一次
    const fromLogin = consumeShowOnLogin()
    const fromAppStart = consumeShowOnAppStart()
    if (fromLogin || fromAppStart) {
      openedByForce = false
      ensureAutoOpenInterval()
      openActivityModal()
      return
    }

    if (!canAutoOpen()) {
      scheduleReopen()
      return
    }

    const stored = Number(localStorage.getItem(nextOpenStorageKey))
    // 未到 8 小时间隔则只排程，避免刷新页面立刻再弹
    if (Number.isFinite(stored) && stored > Date.now()) {
      scheduleReopen()
      return
    }

    openedByForce = false
    ensureAutoOpenInterval()
    openActivityModal()
  }

  /**
   * 窗口订阅入口：已有付费套餐走侧栏续订同一套续费弹窗；
   * 自动续订去钱包管理；免费/试用才进新购页。
   */
  function openWindowSubscribe() {
    const subLevel = userPayInfo.value?.subLevel as SubLevelEnum
    const isFreeOrTrial = [SubLevelEnum.Free, SubLevelEnum.Trial].includes(subLevel)
    if (isFreeOrTrial) {
      router.push({ name: 'subscribe-plan', query: { durationDays: String(WINDOW_SUBSCRIBE_DEFAULT_DAYS) } })
      return
    }

    if (userPayInfo.value?.isAuto) {
      const isExpired = subLevel === SubLevelEnum.Expired
      router.push({ name: 'wallet', query: { name: isExpired ? 'billing' : 'manage' } })
      return
    }

    emitter.emit('showRenewalDialog', {
      defaultDays: WINDOW_SUBSCRIBE_DEFAULT_DAYS,
      paySuccess: () => {
        router.replace({ name: 'wallet', query: { name: 'manage' } })
        emitter.emit('updateBillList')
      },
    })
  }

  /** 打开活动弹窗：先占锁再 showModal，已有实例时不再新建 */
  function openActivityModal() {
    if (dialogInstance || isShowing) {
      return
    }
    isShowing = true
    dialogInstance = showModal({
      header: LOCAL_STORAGE_KEY,
      showHeader: false,
      modal: true,
      blockScroll: true,
      pt: {
        root: '!bg-transparent !border-none !shadow-none',
        mask: '!z-1110',
      },
      handleCancel: onDismiss,
      slots: {
        container: ({ hideModal }) => h(ActivityModal, {
          onClose: () => {
            void hideModal().then(closed => closed && onDismiss())
          },
          onBuy: (kind: 'datacenter' | 'residential' | 'window') => {
            void hideModal().then(async (closed) => {
              if (!closed) {
                return
              }
              onDismiss()
              if (kind === 'window') {
                openWindowSubscribe()
                return
              }
              // 先关活动弹窗再开购买弹窗，避免高 z-index 遮罩叠在购买层上
              try {
                const orderInfo = await buyProxy({ preferredProxyType: kind })
                // 已在列表页时靠事件刷新并高亮新单；再跳到代理 IP 列表，避免买完仍停在原页面
                emitter.emit('updateShopList', orderInfo?.orderNo)
                await router.replace({
                  name: 'agent-list',
                  query: { name: 'shop', orderNo: orderInfo?.orderNo },
                })
              }
              catch {
                // 用户取消购买不提示
              }
            })
          },
        }),
      },
    })
  }

  /** 次日 0 点时间戳，当日满 3 次后等到这时再重置 */
  function nextDayStartMs() {
    const date = new Date()
    date.setHours(24, 0, 0, 0)
    return date.getTime()
  }

  /** 排程下次自动弹出：间隔 8 小时，当日满额则等到次日 */
  function scheduleReopen() {
    if (activityCountdown) {
      return
    }

    if (!canAutoOpen()) {
      activityCountdown = enhanceCountdown(nextDayStartMs(), () => { }, {
        onEnd: () => {
          activityCountdown = undefined
          localStorage.removeItem(nextOpenStorageKey)
          requestModal()
        },
      })
      return
    }

    const stored = Number(localStorage.getItem(nextOpenStorageKey))
    const hasFuture = Number.isFinite(stored) && stored > Date.now()
    // 过期 nextOpen 只说明上次排程已到点；关窗/登录刚弹过之后应重新排 8 小时，不能立刻再弹
    const nextOpenAt = hasFuture ? stored : Date.now() + REOPEN_INTERVAL_MS
    if (!hasFuture) {
      localStorage.setItem(nextOpenStorageKey, String(nextOpenAt))
    }

    activityCountdown = enhanceCountdown(nextOpenAt, () => { }, {
      onEnd: () => {
        activityCountdown = undefined
        localStorage.removeItem(nextOpenStorageKey)
        requestModal()
      },
    })
  }

  /** 侧栏卸载时停掉自动排程并关掉弹窗，避免离开主布局后仍弹出 */
  function disposeAutoSchedule() {
    cancelPendingDispose()
    // 同轮 v-if 重挂时 onMounted 会 cancelPendingDispose，真正离开布局才关窗
    disposeTimer = setTimeout(() => {
      disposeTimer = undefined
      closeModalAndSchedule()
    }, 0)
  }

  return {
    requestModal,
    disposeAutoSchedule,
  }
}
