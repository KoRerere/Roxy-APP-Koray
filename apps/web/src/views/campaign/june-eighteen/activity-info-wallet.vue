<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import { useCampaignStore } from '/@/stores/campaign'

const { seasonalActivity, maxBonus } = storeToRefs(useCampaignStore())

const imageSrc = computed(() => {
  return getImage(`campaing/june-eighteen/small.png`)
})
</script>

<template>
  <div v-if="seasonalActivity.juneEighteen" class="relative rounded-1.5 overflow-hidden">
    <div class="absolute inset-0 flex flex-col justify-center gap-1 pa-3">
      <div class="relative z-1 color-[#111213] font-[Archivo] text-3.75 font-600 leading-4.5">
        {{ $t('Roxy 充值福利月') }}
      </div>
      <i18n-t tag="div" scope="global" class="relative z-1 text-[#34393D] text-3.5 font-500 leading-5 " :keypath="$t('单笔充值最高 {value}', { value: '{value}' })">
        <template #value>
          <span class="font-[DingTalk_JinBuTi] text-[#FF7D00]">{{ $t('赠送 {value}%', { value: maxBonus }) }}</span>
        </template>
      </i18n-t>
    </div>
    <img draggable="false" class="block w-full" :src="imageSrc">
  </div>
</template>

<style lang="scss" scoped></style>
