import { useTimeoutFn } from '@vueuse/core'
import { API } from '/@/api'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { readHasBoundProfile } from './display'
import { useProxyExpireRemind } from './index'
import {
  consumeProxyExpireRemindLogin,
  hasHandledProxyExpireRemindRestart,
  hasProxyExpireRemindLogin,
  markProxyExpireRemindRestartHandled,
  useProxyExpireRemindSilence,
} from './silence'

/** 窗口管理：临期 IP 都没绑窗口时不弹。菜单路由名是 browser，落地后才是这个子路由 */
const PROFILE_ROUTE = 'browser-list'
/** 代理 IP 页：有临期 IP 就弹，并与窗口管理共用冷却 */
const SHOP_ROUTE = 'agent-list'
/** 确认接口失败时的补试次数。窗口管理是默认落地页，第一次失败不能把这次进入丢掉 */
const MAX_CHECK_RETRIES = 2

/**
 * 在主布局监听登录、重启和两个页面。
 * 付费信息未返回前不判断，避免把还没加载的数量当成 0。
 * 真正要弹之前再用 checkOnly 确认总数；窗口管理还要看到已绑定窗口。
 * 没有费用中心权限也弹，续费按钮在弹窗里禁用。
 */
export function useProxyExpireRemindTrigger() {
  const route = useRoute()
  const workspaceStore = useWorkspaceStore()
  const { userPayInfo, payInfoReceivedAt, userInfo } = storeToRefs(useUserStore())
  const { open } = useProxyExpireRemind()
  const silence = useProxyExpireRemindSilence()
  /** 路由变化后尚未完成一次判断；付费信息晚到时补这一次，而不是每次刷新付费信息都再弹 */
  let routeDirty = false
  /** 只作废还在路上的确认请求，避免慢响应在条件失效后把弹窗打开 */
  let confirmSerial = 0
  /** 落地页确认失败后的补试次数，避免接口一失败就再也不弹 */
  let failedChecks = 0

  /** 父级 browser 重定向之后，当前记录或 matched 里才会出现窗口管理 */
  function isNamedRoute(name: string) {
    return route.name === name || route.matched.some(record => record.name === name)
  }

  /** 数量为 0、今日不再提醒，或弹窗已经决定打开时才消费。请求失败不能消费，否则这次登录没有下一次 */
  function finishBypass() {
    consumeProxyExpireRemindLogin()
    if (!hasHandledProxyExpireRemindRestart()) {
      markProxyExpireRemindRestartHandled()
    }
  }

  const { start: retryEvaluate, stop: stopRetry } = useTimeoutFn(() => {
    void evaluate()
  }, 1000, { immediate: false })

  async function evaluate() {
    const userId = userInfo.value.id
    if (!payInfoReceivedAt.value || userId == null) {
      return
    }
    // 先看一眼，等这次判断真的结束再消费。登录落地就是窗口管理，提前消费会被「没绑窗口」吃掉
    const loginBypass = hasProxyExpireRemindLogin()
    const restartBypass = !hasHandledProxyExpireRemindRestart()
    const bypass = loginBypass || restartBypass
    const onWindowPage = isNamedRoute(PROFILE_ROUTE)
    const onShopPage = isNamedRoute(SHOP_ROUTE)
    const onTargetPage = onWindowPage || onShopPage
    const enteredTarget = routeDirty && onTargetPage
    routeDirty = false

    const count = Number(userPayInfo.value.proxyExpireCount) || 0
    if (count <= 0 || silence.isDismissedToday(userId)) {
      finishBypass()
      confirmSerial += 1
      return
    }
    // 冷却中的重复进入不必取消已经发出的确认，否则后到的付费信息刷新会把第一次弹窗吃掉
    if (!bypass && (!enteredTarget || silence.isCoolingDown(userId))) {
      return
    }

    const serial = ++confirmSerial
    const allowOffTarget = bypass
    let summary: { total: number, hasBoundProfile: boolean | undefined }
    try {
      const { code, data } = await API.proxy.userGetProxyExpiringSoonListList({
        page_index: '1',
        page_size: '1',
        checkOnly: '1',
      })
      if (code !== 0 || !data) {
        throw new Error(`[ProxyExpireRemind] check request failed: ${code}`)
      }
      summary = {
        total: Number(data.total) || 0,
        hasBoundProfile: readHasBoundProfile(data.hasBoundProfile),
      }
      // 登录和重启不受这条限制。只有平时进入窗口管理、标记又不是严格 true 时才再对一次列表
      if (!bypass && onWindowPage && summary.hasBoundProfile !== true && summary.total > 0) {
        const listed = await API.proxy.userGetProxyExpiringSoonListList({
          page_index: '1',
          page_size: String(Math.min(Math.max(summary.total, 1), 100)),
        })
        if (listed.code !== 0 || !listed.data) {
          throw new Error(`[ProxyExpireRemind] list request failed: ${listed.code}`)
        }
        // 只在列表里看到关联窗口时改判为要弹。空页不能把「没给标记」写成 false
        if (listed.data.rows?.some(row => (row.profiles?.length ?? 0) > 0)) {
          summary.hasBoundProfile = true
        }
      }
    }
    catch (error) {
      console.error('[ProxyExpireRemind] failed to check expiring proxies', error)
      // 默认落在窗口管理。确认失败时把这次进入还回去，等空间或付费信息就绪后再试
      if ((onWindowPage || onShopPage) && failedChecks < MAX_CHECK_RETRIES) {
        failedChecks += 1
        routeDirty = true
        retryEvaluate()
      }
      return
    }
    if (serial !== confirmSerial) {
      return
    }
    failedChecks = 0
    const stillOnWindowPage = isNamedRoute(PROFILE_ROUTE)
    const stillOnTarget = stillOnWindowPage || isNamedRoute(SHOP_ROUTE)
    if (!allowOffTarget && !stillOnTarget) {
      return
    }
    if (summary.total <= 0 || silence.isDismissedToday(userId)) {
      finishBypass()
      return
    }
    // 登录、重启只要有临期 IP 就弹。没绑窗口只拦住之后再进入窗口管理
    if (!bypass && stillOnWindowPage && summary.hasBoundProfile === false) {
      return
    }

    finishBypass()
    void open({
      ipCount: summary.total,
      hasBoundProfile: summary.hasBoundProfile,
      onUserDismiss: () => {
        const id = userInfo.value.id
        if (id != null) {
          silence.startCooldown(id)
        }
      },
      onDismissToday: (checked: boolean) => {
        const id = userInfo.value.id
        if (id != null) {
          silence.setDismissToday(id, checked)
        }
      },
    })
  }

  watch(() => route.name, () => {
    stopRetry()
    failedChecks = 0
    routeDirty = true
    void evaluate()
  }, { immediate: true })

  watch(payInfoReceivedAt, () => {
    void evaluate()
  })

  watch(() => userInfo.value.id, () => {
    void evaluate()
  })

  // 冷启动时空间 id 比布局更晚写上，第一次确认会缺 workspaceId
  watch(() => workspaceStore.currentWorkspace?.id, () => {
    void evaluate()
  })
}
