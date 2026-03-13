<script setup lang="ts">
import NewYear from '/@/views/campaign/new-year/index.vue'
import SpringFestival from '/@/views/campaign/spring-festival/index.vue'
import { useCampaignStore } from '/@/stores/campaign'
import { enhanceCountdown, sleep } from '/@/utils'
import { ActivityType } from '/@/enums/base'

const { currentActivity, seasonalActivity } = storeToRefs(useCampaignStore())
const { getActivityInfo } = useCampaignStore()

const stopCountdown = ref()
const activityMap = {
  [ActivityType.NewYear]: {
    component: markRaw(NewYear),
    localStorageKey: '$NewYearModalStatus',
  },
  [ActivityType.SpringFestival]: {
    component: markRaw(SpringFestival),
    localStorageKey: '$SpringFestivalModalStatus',
  },
}

const activity = computed(() => {
  if (!currentActivity.value)
    return undefined
  return activityMap[currentActivity.value.type as keyof typeof activityMap]
})

onBeforeMount(() => {
  getHolidaySeason()
})

onBeforeUnmount(() => {
  stopCountdown.value?.stop()
})

async function getHolidaySeason() {
  await getActivityInfo()
  stratHolidaySeasonCountdown()
  clearExpiredLocalStorageKey()
}

function stratHolidaySeasonCountdown() {
  if (!seasonalActivity.value.active)
    return

  const timeStamp = seasonalActivity.value.active
    ? currentActivity.value.end_timestamp
    : currentActivity.value.start_timestamp

  stopCountdown.value = enhanceCountdown(timeStamp, () => { }, {
    onEnd: async () => {
      await sleep(300)
      await getHolidaySeason()
    },
  })
}

function clearExpiredLocalStorageKey() {
  Object.entries(activityMap).forEach(([type, { localStorageKey }]) => {
    if (currentActivity.value.type === Number(type))
      return
    localStorage.removeItem(localStorageKey)
  })
}
</script>

<template>
  <component :is="activity.component" v-if="seasonalActivity.active && activity" :local-storage-key="activity.localStorageKey" />
</template>

<style scoped></style>
