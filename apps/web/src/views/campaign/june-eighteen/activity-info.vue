<script setup lang="ts">
import currency from 'currency.js'
import { getImage } from '/@/utils/basic'
import { useCampaignStore } from '/@/stores/campaign'
import { useSimpleLocale } from '/@/stores/locale'

const { currentLocale } = storeToRefs(useSimpleLocale())
const { maxBonus, seasonalActivity } = storeToRefs(useCampaignStore())
const { getActivityTotalRecharge } = useCampaignStore()

const imageSrc = computed(() => {
  const suffix = ['zh-CN', 'en'].includes(currentLocale.value!) ? currentLocale.value : 'en'
  return getImage(`campaing/june-eighteen/large_${suffix}.png`)
})

function formatAmount(amount: number) {
  return currency(amount, { precision: 0 }).format()
}
</script>

<template>
  <div v-if="seasonalActivity.juneEighteen" class="relative rounded-1.5 overflow-hidden">
    <div class="absolute inset-0 flex flex-col justify-center px-4">
      <i18n-t class="text-5.5 font-600 font-[Archivo] color-white" tag="div" scope="global" :keypath="$t('Roxy 超级充值季·最高 {bonus}', { bonus: '{bonus}' })">
        <template #bonus>
          <span class="text-6.5 font-400 font-[DingTalk_JinBuTi] text">{{ $t('赠送 {value}', { value: `${maxBonus}%` }) }}</span>
        </template>
      </i18n-t>

      <div class="flex flex-col mt-3">
        <i18n-t tag="div" scope="global" class="text-3.5 font-500 leading-5.5 color-white whitespace-pre-wrap"
                :keypath="$t('充 {start} 起享赠送，充 {amount} 得 {value}', { start: formatAmount(10), amount: formatAmount(100), value: '{value}' })"
        >
          <template #value>
            <span class="font-bold text">{{ formatAmount(getActivityTotalRecharge(100)) }}</span>
          </template>
        </i18n-t>
        <i18n-t tag="div" scope="global" class="text-3.5 font-500 leading-5.5 color-white" :keypath="$t('充 {amount} 得 {value}', { amount: formatAmount(1000), value: '{value}' })">
          <template #value>
            <span class="font-bold text">{{ formatAmount(getActivityTotalRecharge(1000)) }}</span>
          </template>
        </i18n-t>
      </div>
    </div>
    <img draggable="false" class="block w-full" :src="imageSrc">
  </div>
</template>

<style lang="scss" scoped>
.text {
  background: linear-gradient(97deg, #05caed 0%, #47d769 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>
