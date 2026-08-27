import currency from 'currency.js'
import { defineStore } from 'pinia'
import { useDocumentVisibility, useIntervalFn } from '@vueuse/core'
import { API } from '/@/api'
import { enhanceCountdown } from '/@/utils'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { isEcommerceWorkspace } from '/@/utils/workspace-mode'
import { NEW_USER_IP_DURATION_DAYS } from '/@/views/campaign/new-user/proxy-pricing'
import type { UserGetNewUserBenefitConfigListData } from '@roxy/backend-api'

/** 新人福利接口业务数据 */
type NewUserBenefit = UserGetNewUserBenefitConfigListData['data']

function emptyBenefit(): NewUserBenefit {
  return {
    start_timestamp: 0,
    end_timestamp: 0,
    server_utc_timestamp: 0,
    eligible: false,
    promoActive: false,
    withinRegisterWindow: false,
    registerExpireTimestamp: 0,
    usage: {
      datacenter: false,
      residential: false,
      window: false,
    },
    remaining: {
      datacenter: false,
      residential: false,
      window: false,
    },
    datacenterPrice: 0,
    residentialPrice: 0,
    residentialCountries: [],
    residentialOwnCountries: [],
    windowGiftMonths: {} as NewUserBenefit['windowGiftMonths'],
  }
}

export const useNewUserBenefitStore = defineStore('newUserBenefit', () => {
  const { token } = storeToRefs(useUserStore())
  const { currentWorkspace } = storeToRefs(useWorkspaceStore())
  const benefit = ref<NewUserBenefit>(emptyBenefit())
  /** 本地时钟相对服务端的偏移，用于校准活动/注册窗口倒计时 */
  const clockOffsetMs = ref(0)
  /** 活动未开始或已到点时立刻关掉 UI，不等下一次接口 */
  const locallyEnded = ref(false)
  /** 对准活动开始/结束或注册窗口到期，到点刷新资格 */
  let lifecycleCountdown: ReturnType<typeof enhanceCountdown> | undefined
  /** 换账号或新请求发出后作废仍在途的旧响应，避免把上一账号资格写回来 */
  let fetchBenefitRequestId = 0

  const remainingAny = computed(() => {
    const { datacenter, residential, window: windowRemain } = benefit.value.remaining
    return datacenter || residential || windowRemain
  })

  /** 校准后的时间戳：接口毫秒 + 本地相对服务端偏移 */
  function toLocalTime(timestamp: number) {
    return timestamp > 0 ? timestamp + clockOffsetMs.value : 0
  }

  /** 活动开始时间（本地时钟） */
  const promoStartAt = computed(() => toLocalTime(benefit.value.start_timestamp))
  /** 活动结束与注册窗口取更早者，倒计时/展示都用这个 */
  const expireAt = computed(() => {
    const ends = [toLocalTime(benefit.value.end_timestamp), toLocalTime(benefit.value.registerExpireTimestamp)].filter(time => time > 0)
    return ends.length ? Math.min(...ends) : 0
  })

  /** 当前时刻是否仍在活动期内（开始后、结束前） */
  function isWithinPromoClock(now = Date.now()) {
    const startAt = promoStartAt.value
    const endAt = expireAt.value
    if (startAt && now < startAt) {
      return false
    }
    if (endAt && now >= endAt) {
      return false
    }
    return true
  }

  /** 接口资格 + 本地时钟；电商工作区不展示、不计价 */
  const promoLive = computed(() => {
    if (locallyEnded.value) {
      return false
    }
    if (isEcommerceWorkspace(currentWorkspace.value?.workspaceType)) {
      return false
    }
    const { eligible, promoActive, withinRegisterWindow } = benefit.value
    return eligible && promoActive && withinRegisterWindow && isWithinPromoClock()
  })

  /** 资格有效且至少一款未买齐时才展示入口/卡片 */
  const visible = computed(() => promoLive.value && remainingAny.value)

  const windowGiftMonths3 = computed(() => benefit.value.windowGiftMonths?.['3'])

  /** 窗口买赠仍可用（活动进行中且该档未用完） */
  const windowOfferActive = computed(() => promoLive.value && benefit.value.remaining.window)

  /** 仅按接口 windowGiftMonths 换算赠送天数，缺档或未开通则不展示 */
  function getWindowGiftDays(paidDays: number) {
    if (!windowOfferActive.value) {
      return 0
    }

    const months = Math.round(paidDays / 30)
    const giftMonths = (benefit.value.windowGiftMonths as Record<string, number | undefined>)[String(months)]
    if (!giftMonths) {
      return 0
    }

    return giftMonths * 30
  }

  /** 按代理购买页同一套美元金额格式化 */
  function formatPrice(amount: number) {
    return currency(amount).format()
  }

  const datacenterPriceText = computed(() => formatPrice(benefit.value.datacenterPrice))
  const residentialPriceText = computed(() => formatPrice(benefit.value.residentialPrice))

  /**
   * 对应类型仍有额度、活动进行中，且购买 30 天才套用新人 IP 价。
   * 静态住宅还须落在接口 residentialCountries 白名单内，其它国家走原价。
   */
  function isNewUserIpOffer(kind: 'datacenter' | 'residential', durationDays: number, countryCode?: string) {
    if (!promoLive.value || !benefit.value.remaining[kind] || durationDays !== NEW_USER_IP_DURATION_DAYS) {
      return false
    }
    if (kind === 'residential') {
      return isResidentialCountryEligible(countryCode)
    }
    return true
  }

  /** 静态住宅新人价只覆盖接口下发的国家码（大小写不敏感） */
  function isResidentialCountryEligible(countryCode?: string) {
    const code = countryCode?.trim().toLowerCase()
    if (!code) {
      return false
    }
    return benefit.value.residentialCountries.some(item => item.toLowerCase() === code)
  }

  /** 接口下发的该类型新人单价 */
  function newUserIpUnitPrice(kind: 'datacenter' | 'residential') {
    return kind === 'datacenter' ? benefit.value.datacenterPrice : benefit.value.residentialPrice
  }

  /** 停掉活动生命周期倒计时 */
  function stopLifecycleCountdown() {
    lifecycleCountdown?.stop()
    lifecycleCountdown = undefined
  }

  /** 清空资格，所有绑定 visible / 买赠的 UI 立即收起 */
  function resetBenefit() {
    stopLifecycleCountdown()
    locallyEnded.value = true
    benefit.value = emptyBenefit()
    clockOffsetMs.value = 0
  }

  /**
   * 对准开始/结束时刻：未开始先隐藏，到点再拉接口；已到结束则立刻清空。
   */
  function armLifecycleCountdown() {
    stopLifecycleCountdown()
    locallyEnded.value = false
    const now = Date.now()
    const startAt = promoStartAt.value
    const endAt = expireAt.value

    if (startAt > now) {
      locallyEnded.value = true
      lifecycleCountdown = enhanceCountdown(startAt, () => { }, {
        onEnd: () => {
          locallyEnded.value = false
          void fetchBenefit()
        },
      })
      return
    }

    if (endAt > 0 && now >= endAt) {
      resetBenefit()
      return
    }

    if (endAt > now) {
      lifecycleCountdown = enhanceCountdown(endAt, () => { }, {
        onEnd: () => {
          resetBenefit()
        },
      })
    }
  }

  /**
   * 购买代理 / 窗口订阅成功后刷新资格。
   * 仅在当前仍展示新人福利时请求，避免无关购买打接口。
   */
  function refreshBenefitIfEligible() {
    if (!visible.value) {
      return
    }
    return fetchBenefit()
  }

  /** 拉取新人福利资格；失败或活动已结束时隐藏入口 */
  async function fetchBenefit() {
    const requestId = ++fetchBenefitRequestId
    try {
      const { code, data } = await API.base.userGetNewUserBenefitConfigList()
      if (requestId !== fetchBenefitRequestId) {
        return
      }
      if (code !== 0 || !data) {
        resetBenefit()
        return
      }

      clockOffsetMs.value = Date.now() - data.server_utc_timestamp
      benefit.value = data
      locallyEnded.value = false
      armLifecycleCountdown()
    }
    catch (error) {
      if (requestId !== fetchBenefitRequestId) {
        return
      }
      console.error('[NewUserBenefit] fetch failed', error)
      resetBenefit()
    }
  }

  const documentVisibility = useDocumentVisibility()
  const { pause: pausePromoPoll, resume: resumePromoPoll } = useIntervalFn(() => {
    void fetchBenefit()
  }, 60_000, { immediate: false })

  /** 已登录且页面可见时轮询，运营关活动后最多约 1 分钟内收起 UI */
  function syncPromoPoll() {
    const hasToken = Boolean(useUserStore().token)
    if (hasToken && documentVisibility.value === 'visible' && promoLive.value) {
      resumePromoPoll()
    }
    else {
      pausePromoPoll()
    }
  }

  watch(documentVisibility, (state) => {
    if (state === 'visible' && useUserStore().token) {
      void fetchBenefit()
    }
    syncPromoPoll()
  })

  watch(promoLive, () => syncPromoPoll())

  // 登出/换账号立刻丢掉上一份资格，否则侧栏仍按旧账号挂载弹窗，新账号无资格时会闪开再被关掉
  watch(token, (currentToken, previousToken) => {
    if (currentToken === previousToken) {
      return
    }
    fetchBenefitRequestId++
    resetBenefit()
    if (currentToken) {
      void fetchBenefit()
    }
  })

  // 切空间后请求会带上新的 workspace header，资格/用量可能不同，作废在途响应再拉一次
  watch(() => currentWorkspace.value?.id, (workspaceId, previousWorkspaceId) => {
    if (workspaceId === previousWorkspaceId) {
      return
    }
    if (!workspaceId || !token.value) {
      return
    }
    fetchBenefitRequestId++
    void fetchBenefit()
  })

  return {
    benefit,
    visible,
    remainingAny,
    expireAt,
    windowGiftMonths3,
    windowOfferActive,
    datacenterPriceText,
    residentialPriceText,
    getWindowGiftDays,
    fetchBenefit,
    refreshBenefitIfEligible,
    isNewUserIpOffer,
    newUserIpUnitPrice,
  }
}, {
  persist: false,
})
