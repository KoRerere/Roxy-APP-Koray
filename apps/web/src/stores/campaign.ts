import { defineStore } from 'pinia'
import { API } from '/@/api'
import { ActivityType } from '/@/enums/base'
import type { GetSpringFestivalTimeListData } from '@roxy/backend-api'

type Activity = GetSpringFestivalTimeListData['data'] & { type: ActivityType, discountPercentage?: number }

export const useCampaignStore = defineStore('campaign', () => {
  const currentActivity = ref<Activity>({} as Activity)

  const seasonalActivity = computed(() => {
    const { type, start_timestamp, end_timestamp } = currentActivity.value
    const active = start_timestamp <= Date.now() && end_timestamp >= Date.now()

    return {
      active,
      none: type === ActivityType.None,
      newYear: active && type === ActivityType.NewYear,
      springFestival: active && type === ActivityType.SpringFestival,
    }
  })

  async function getActivityInfo() {
    const { code, data } = await API.base.getSpringFestivalTimeList()
    if (code !== 0) {
      currentActivity.value = {} as Activity
      return
    }
    currentActivity.value = { ...data, type: ActivityType.SpringFestival }
  }

  return {
    currentActivity,
    seasonalActivity,
    getActivityInfo,
  }
}, {
  persist: false,
})
