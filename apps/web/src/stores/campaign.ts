import { defineStore } from 'pinia'
import { API } from '/@/api'
import { ActivityType } from '/@/enums/base'
import { useUserStore } from '/@/stores/user'
import { isEmptyValue } from '/@/utils'
import type { GetMayFreedomSeasonPromoTimeListData } from '@roxy/backend-api'

type Activity = GetMayFreedomSeasonPromoTimeListData['data'] & { isFreedom?: boolean }

export const useCampaignStore = defineStore('campaign', () => {
  const { userInfo } = storeToRefs(useUserStore())
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
    }
  })

  async function getActivityInfo() {
    const { code, data } = await API.base.getMayFreedomSeasonPromoTimeList()
    if (code !== 0) {
      currentActivity.value = {} as Activity
      return
    }

    currentActivity.value = { ...data, isFreedom: !isEmptyValue(userInfo.value.userBadgeList) }
  }

  return {
    currentActivity,
    seasonalActivity,
    getActivityInfo,
  }
}, {
  persist: false,
})
