<script setup lang="ts">
import { useCampaignStore } from '/@/stores/campaign'

const { currentActivity, seasonalActivity } = storeToRefs(useCampaignStore())
</script>

<template>
  <div v-if="seasonalActivity.freedom" class="relative flex flex-col gap-1 pa-3 rounded-1.5 overflow-hidden">
    <div class="relative text-[#111213] font-[DingTalk_JinBuTi] text-3.25 font-500 leading-4.5 z-1">
      {{ $t('五月自由季') }}
    </div>
    <div class="relative text-[#111213] text-3.25 font-600 leading-4.5 z-1 ">
      {{ $t('永久勋章 + 终身 {discount}% 折扣权益', { discount: currentActivity.discount }) }}
    </div>

    <img draggable="false" class="absolute inset-0 w-full h-full" src="/images/campaing/freedom/mid_bg.png">
    <SvgIcon class="absolute w-16.5 h-16.5 -right-1.5 -bottom-1.5" name="other/palm_tree" size="34" />
  </div>
</template>

<style lang="scss" scoped>
</style>
