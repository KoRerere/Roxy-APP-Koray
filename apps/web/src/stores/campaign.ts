import currency from 'currency.js'
import { defineStore } from 'pinia'
import { API } from '/@/api'
import { ActivityType } from '/@/enums/base'
import type { GetJuneRechargePromoTimeListData } from '@roxy/backend-api'

type Activity = GetJuneRechargePromoTimeListData['data']

export const useCampaignStore = defineStore('campaign', () => {
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
      freedom: active && type === ActivityType.Freedom,
      juneEighteen: active && type === ActivityType.JuneEighteen,
    }
  })

  const maxBonus = computed(() => {
    return currentActivity.value.recharge_benefits.reduce((max, item) => Math.max(max, item.discount), 0)
  })

  async function getActivityInfo() {
    const { code, data } = await API.base.getJuneRechargePromoTimeList()
    if (code !== 0) {
      currentActivity.value = {} as Activity
      return
    }

    currentActivity.value = data
  }

  function getActivityPercentage(amount: number) {
    if (!seasonalActivity.value.juneEighteen)
      return 0

    return currentActivity.value.recharge_benefits?.findLast(item => item.amount <= amount)?.discount ?? 0
  }

  function getActualRecharge(amount: number) {
    if (!seasonalActivity.value.juneEighteen)
      return amount

    const percentage = getActivityPercentage(amount)
    if (!percentage)
      return amount

    return currency(amount).divide(currency(percentage).divide(100).add(1).value).value
  }

  function getActivityTotalRecharge(amount: number) {
    const percentage = getActivityPercentage(amount)
    return currency(amount).multiply(percentage).divide(100).add(amount).value
  }

  return {
    currentActivity,
    seasonalActivity,
    maxBonus,
    getActivityInfo,
    getActivityPercentage,
    getActualRecharge,
    getActivityTotalRecharge,
  }
}, {
  persist: false,
})
