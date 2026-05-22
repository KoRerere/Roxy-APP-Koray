<script setup lang="ts">
import Referal from './components/referal/index.vue'
import ReferralUsers from './components/referral-users.vue'
import RewardRecords from './components/reward-records.vue'
import WithdrawRecords from './components/withdraw-records.vue'
import { provideReferralProgram } from './useContext'
import { API } from '/@/api'

const tabs = [
  {
    title: $t('概览'),
    value: 'referal',
    component: Referal,
  },
  {
    title: $t('奖励明细'),
    value: 'reward',
    component: RewardRecords,
  },
  {
    title: $t('提现记录'),
    value: 'withdraw',
    component: WithdrawRecords,
  },
  {
    title: $t('名下用户'),
    value: 'users',
    component: ReferralUsers,
  },
]

const defaultTab = tabs.at(0)!
const activeTabValue = ref(defaultTab.value)

const promotionInfo = ref()

const activeTab = computed(() => {
  return tabs.find(n => n.value === activeTabValue.value)
})

watch(activeTabValue, () => {
  if (activeTabValue.value === defaultTab.value) {
    getPromotionInfo()
  }
}, { immediate: true })

provideReferralProgram({
  getPromotionInfo,
})

async function getPromotionInfo() {
  const { code, data } = await API.base.userGetPromotionInfoList()
  if (code === 0) {
    promotionInfo.value = data
  }
}
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <RxTabs v-model:value="activeTabValue" :tabs="tabs" head-tabs only-tabs />
    <div class="flex flex-1 overflow-hidden">
      <component :is="activeTab?.component" v-if="promotionInfo" :promotion-info />
    </div>
  </div>
</template>

<style scoped></style>
