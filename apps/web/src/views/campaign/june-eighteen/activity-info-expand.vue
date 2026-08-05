<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import { useCampaignStore } from '/@/stores/campaign'

const { seasonalActivity, maxBonus } = storeToRefs(useCampaignStore())

const imageSrc = computed(() => {
  return `url('${getImage(`campaing/june-eighteen/mid.png`)}')`
})
</script>

<template>
  <div v-if="seasonalActivity.juneEighteen" class="relative flex flex-col justify-center gap-1 py-3 px-4 rounded-1.5 overflow-hidden content">
    <div class="text-[#111213] font-[Archivo] text-4.5 font-600 leading-6">
      {{ $t('Roxy 充值福利月') }}
    </div>
    <i18n-t tag="div" scope="global" class="relative z-1 text-[#34393D] text-3.25 font-500 leading-4.5 whitespace-pre-wrap"
            :keypath="$t('单笔充值最高 {value}，活动期间{light}', { value: '{value}', light: '{light}' })"
    >
      <template #value>
        <span class="font-[DingTalk_JinBuTi] text-[#FF7D00]">{{ $t('赠送 {value}%', { value: maxBonus }) }}</span>
      </template>
      <template #light>
        <span class="text-[#FF7D00]">{{ $t('多充多送') }}</span>
      </template>
    </i18n-t>
  </div>
</template>

<style lang="scss" scoped>
.content {
  background-image: v-bind(imageSrc);
  background-size: cover;
  background-repeat: no-repeat;
  background-position: right bottom;
}
</style>
