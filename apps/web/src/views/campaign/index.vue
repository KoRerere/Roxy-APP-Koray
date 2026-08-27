<script setup lang="ts">
import NewYear from '/@/views/campaign/new-year/index.vue'
import SpringFestival from '/@/views/campaign/spring-festival/index.vue'
import Easter from '/@/views/campaign/easter/index.vue'
import Freedom from '/@/views/campaign/freedom/index.vue'
import NewUser from '/@/views/campaign/new-user/index.vue'
import { useCampaignStore } from '/@/stores/campaign'
import { useNewUserBenefitStore } from '/@/stores/new-user-benefit'
import { enhanceCountdown, sleep } from '/@/utils'
import { ActivityType } from '/@/enums/base'

const { collapsed = false } = defineProps<{
  collapsed?: boolean
}>()

const { currentActivity, seasonalActivity } = storeToRefs(useCampaignStore())
const { getActivityInfo } = useCampaignStore()
const { visible: newUserVisible } = storeToRefs(useNewUserBenefitStore())
const { fetchBenefit } = useNewUserBenefitStore()

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
  [ActivityType.Easter]: {
    component: markRaw(Easter),
    localStorageKey: '$EasterModalStatus',
  },
  [ActivityType.Freedom]: {
    component: markRaw(Freedom),
    localStorageKey: '$FreedomModalStatus',
  },
}

const activity = computed(() => {
  if (!currentActivity.value)
    return undefined
  return activityMap[currentActivity.value.type as keyof typeof activityMap]
})

onBeforeMount(() => {
  getActivityBySeason()
})

onBeforeUnmount(() => {
  stopCountdown.value?.stop()
})

async function getActivityBySeason() {
  await Promise.all([getActivityInfo(), fetchBenefit()])
  stratHolidaySeasonCountdown()
  clearExpiredLocalStorageKey()
}

function stratHolidaySeasonCountdown() {
  if (seasonalActivity.value.none)
    return

  const timeStamp = seasonalActivity.value.active
    ? currentActivity.value.end_timestamp
    : currentActivity.value.start_timestamp

  stopCountdown.value = enhanceCountdown(timeStamp, () => { }, {
    onEnd: async () => {
      await sleep(300)
      await getActivityBySeason()
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
    <NewUser v-if="newUserVisible" :collapsed />
  <component :is="activity.component" v-if="seasonalActivity.active && activity" :collapsed :local-storage-key="activity.localStorageKey" />
</template>

<style scoped></style>
