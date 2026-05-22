<script setup lang="tsx">
import type { UserGetPromotionInfoListData } from '@roxy/backend-api'
import ReferalLink from './referal-link.vue'
import ReferalReward from './referal-reward.vue'
import { useSimpleLocale } from '/@/stores/locale'

defineProps<{
  promotionInfo: UserGetPromotionInfoListData['data']
}>()

const { currentLocale, getOfficialWebsite } = useSimpleLocale()

const bonusImage = computed(() => {
  if (['zh-CN', 'en', 'ru'].includes(currentLocale!)) {
    return `/images/invite-bonus-banner_${currentLocale}.png`
  }
  return '/images/invite-bonus-banner_en.png'
})

function viewDetail() {
  window.open(getOfficialWebsite('/blog/referral-power-up'), '_blank')
}

const hideBonus = computed(() => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Pacific/Kiritimati' })) >= new Date('2025-10-27T00:00:00')
})
</script>

<template>
  <div class="referal">
    <div class="reward">
      <ReferalReward class="py-4 mx-auto mt-5 content" :promotion-info />
    </div>
    <div v-if="!hideBonus" class="relative flex items-center py-4 mx-auto mt-5 content">
      <RxButton class="!absolute right-16" size="lg" @click="viewDetail">
        <template #default>
          <span>{{ $t('查看详情') }}</span>
          <SvgIcon name="base/rx_ic_arrow_right" />
        </template>
      </RxButton>
      <img class="block w-full rounded-xl" :src="bonusImage">
    </div>
    <ReferalLink v-if="promotionInfo.promotionLinkList?.length" class="pt-10 pb-20 mx-auto content" :promotion-info />
  </div>
</template>

<style lang="scss" scoped>
.referal {
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: auto;

  .reward {
    background-image: url('/images/referral-program/referal-reward-bg.png');
    background-position: right -260px bottom -20px;
    background-size: 100% 100%;
    background-repeat: no-repeat;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--colors-border-border-inactive, #293038);
  }

  .content {
    width: min(1080px, 100%);
  }
}

[data-theme='dark'] .reward {
  background-image: url('/images/referral-program/referal-reward-bg-dark.png');
}
</style>
