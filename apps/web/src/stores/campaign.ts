import { defineStore } from 'pinia'
import { API } from '/@/api'

import type { GetBlackFridayTimeListData } from '@roxy/backend-api'

type BlackFriday = GetBlackFridayTimeListData['data']

export const useCampaignStore = defineStore('campaign', () => {
  const blackFridayPeriod = ref(false)
  const blackFridayInfo = ref<BlackFriday>()

  async function getBlackFridayInfo() {
    const { code, data } = await API.base.getBlackFridayTimeList()
    if (code !== 0) return
    blackFridayPeriod.value = data.start_timestamp <= Date.now() && data.end_timestamp >= Date.now()
    blackFridayInfo.value = data
  }

  return {
    blackFridayPeriod,
    blackFridayInfo,
    getBlackFridayInfo
  }
}, {
  persist: false,
})
