import { defineStore } from 'pinia'
import { API } from '/@/api'
import { ActivityType } from '/@/enums/base'
import { useUserStore } from '/@/stores/user'
import { discountCalculate } from '/@/views/pay/subscribe/util.ts'
import type { GetEasterPromoTimeListData } from '@roxy/backend-api'

type Activity = GetEasterPromoTimeListData['data']

export const useCampaignStore = defineStore('campaign', () => {
  const { userPayInfo } = storeToRefs(useUserStore())

  const currentActivity = ref<Activity>({} as Activity)

  const seasonalActivity = computed(() => {
    const { type, start_timestamp, end_timestamp } = currentActivity.value
    const active = start_timestamp <= Date.now() && end_timestamp >= Date.now()

    return {
      active,
      none: !type || type === ActivityType.None,
      newYear: active && type === ActivityType.NewYear,
      springFestival: active && type === ActivityType.SpringFestival,
      easter: active && type === ActivityType.Easter,
    }
  })

  async function getActivityInfo() {
    const { code, data } = await API.base.getEasterPromoTimeList()
    if (code !== 0) {
      currentActivity.value = {} as Activity
      return
    }

    currentActivity.value = data
  }

  function discountSpecialCalculate(selfDiscount: number, type: 'proxy' | 'subscribe' = 'subscribe') {
    const specialDiscount = userPayInfo.value.isEaster
      ? discountCalculate([type === 'proxy' ? currentActivity.value.proxyDiscount : currentActivity.value.discount])
      : 1
    return Math.min(specialDiscount, selfDiscount)
  }

  return {
    currentActivity,
    seasonalActivity,
    getActivityInfo,
    discountSpecialCalculate,
  }
}, {
  persist: false,
})
