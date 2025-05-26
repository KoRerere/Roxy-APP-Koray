<script setup lang="tsx">
import type { UserGetPromotionInfoListData } from '@roxy/backend-api';
import ReferalLink from './referal-link.vue';
import ReferalReward from './referal-reward.vue'

const { promotionInfo } = defineProps<{
  promotionInfo: UserGetPromotionInfoListData['data']
}>()
</script>

<template>
  <div class="referal">
    <div class="reward">
      <ReferalReward class="content" :promotionInfo />
    </div>
    <ReferalLink v-if="promotionInfo.promotionLinkList?.length" class="content" :promotionInfo />
  </div>
</template>

<style scoped>
.referal {
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: auto;

  .reward {
    background-image: url('/images/referral-program/referal-reward-bg.png');
    background-position: right -320px bottom -50px;
    background-size: 100% 100%;
    background-repeat: no-repeat;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--colors-border-border-inactive, #293038);
  }

  .content {
    padding: 16px 32px;
    width: min(1000px, 100%);
    margin: 20px auto 0 auto;
  }
}

[data-theme="dark"] .reward {
  background-image: url('/images/referral-program/referal-reward-bg-dark.png');
}
</style>
