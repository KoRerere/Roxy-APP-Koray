import { defineStore } from 'pinia'
import { API } from '/@/api'
import { ActivityType } from '/@/enums/base'
import type { GetActivityDiscountListData, GetBlackFridayTimeListData } from '@roxy/backend-api'

type BlackFriday = GetBlackFridayTimeListData['data']

type Activity = GetActivityDiscountListData['data']

export const useCampaignStore = defineStore('campaign', () => {
  const blackFridayPeriod = ref(false)
  const blackFridayInfo = ref<BlackFriday>()

  async function getBlackFridayInfo() {
    const { code, data } = await API.base.getBlackFridayTimeList()
    if (code !== 0)
      return
    blackFridayPeriod.value = data.start_timestamp <= Date.now() && data.end_timestamp >= Date.now()
    blackFridayInfo.value = data
  }

  const currentActivity = ref<Activity>({} as Activity)

  const seasonalActivity = computed(() => {
    const { type, start_timestamp, end_timestamp } = currentActivity.value
    const active = start_timestamp <= Date.now() && end_timestamp >= Date.now()

    return {
      active,
      none: type === ActivityType.None,
      newYear: active && type === ActivityType.NewYear,
    }
  })

  async function getActivityInfo() {
    const { code, data } = await API.base.getActivityDiscountList()
    if (code !== 0)
      return
    currentActivity.value = data
  }

  return {
    blackFridayPeriod,
    blackFridayInfo,
    getBlackFridayInfo,
    currentActivity,
    seasonalActivity,
    getActivityInfo,
  }
}, {
  persist: false,
})
