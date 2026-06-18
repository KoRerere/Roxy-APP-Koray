<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import { useCampaignStore } from '/@/stores/campaign'
import { useSimpleLocale } from '/@/stores/locale'

const { seasonalActivity, maxBonus } = storeToRefs(useCampaignStore())
const { currentLocale } = storeToRefs(useSimpleLocale())

const imageSrc = computed(() => {
  const suffix = ['zh-CN', 'en'].includes(currentLocale.value!) ? currentLocale.value : 'en'
  return getImage(`campaing/june-eighteen/mid_${suffix}.png`)
})
</script>

<template>
  <div v-if="seasonalActivity.juneEighteen" class="relative rounded-1.5 overflow-hidden">
    <div class="absolute inset-0 flex flex-col justify-center gap-1 pa-3">
      <div class="text-white font-[Archivo] text-3.75 font-600 leading-4.5">
        {{ $t('Roxy 超级充值季') }}
      </div>
      <i18n-t tag="div" scope="global" class="relative z-1 text-[#989CA0] text-3.5 font-600 leading-5 "
              :keypath="$t('单笔充值最高赠送 {value}，活动期间多充多送', { value: '{value}' })"
      >
        <template #value>
          <span class="text-white">{{ maxBonus }}%</span>
        </template>
      </i18n-t>
    </div>
    <img draggable="false" class="block w-full" :src="imageSrc">
  </div>
</template>

<style lang="scss" scoped></style>
