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
    const inWindow = start_timestamp <= Date.now() && end_timestamp >= Date.now()
    // 618 已归档，即使后端仍返回 type=6 也不再当作进行中的季节活动
    const archived = type === ActivityType.JuneEighteen
    const active = inWindow && !archived

    return {
      active,
      none: !type || type === ActivityType.None || archived,
      newYear: active && type === ActivityType.NewYear,
      springFestival: active && type === ActivityType.SpringFestival,
      easter: active && type === ActivityType.Easter,
      freedom: active && type === ActivityType.Freedom,
      juneEighteen: false,
    }
  })

  const maxBonus = computed(() => {
    return currentActivity.value.recharge_benefits?.reduce((max, item) => Math.max(max, item.discount), 0)
  })

  /** 充值档位展示文案：区间由相邻档位推算，末档为「及以上」 */
  const rechargeBenefitTiers = computed(() => {
    const benefits = currentActivity.value.recharge_benefits ?? []
    return benefits.map((item, index, array) => {
      const next = array[index + 1]
      const start = currency(item.amount, { precision: 0 }).format()
      if (!next) {
        return {
          amount: item.amount,
          discount: item.discount,
          range: start,
          isLast: true as const,
        }
      }

      const end = currency(next.amount, { precision: 0 }).subtract(1).format()
      return {
        amount: item.amount,
        discount: item.discount,
        range: `${start}-${end}`,
        isLast: false as const,
      }
    })
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
    rechargeBenefitTiers,
    getActivityInfo,
    getActivityPercentage,
    getActualRecharge,
    getActivityTotalRecharge,
  }
}, {
  persist: false,
})
