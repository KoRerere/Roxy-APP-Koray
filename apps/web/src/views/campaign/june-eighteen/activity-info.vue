<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import { useCampaignStore } from '/@/stores/campaign'

const { seasonalActivity, rechargeBenefitTiers, maxBonus } = storeToRefs(useCampaignStore())

const imageSrc = computed(() => {
  return `url('${getImage(`campaing/june-eighteen/large.png`)}')`
})

const frontTiers = computed(() => rechargeBenefitTiers.value.slice(0, 2))

const lastTier = computed(() => {
  const tiers = rechargeBenefitTiers.value
  return tiers[tiers.length - 1]
})
</script>

<template>
  <div v-if="seasonalActivity.juneEighteen" class="relative rounded-1.5 overflow-hidden">
    <div class="flex flex-col justify-center gap-1.5 pa-4 content">
      <i18n-t class="text-5 font-700 font-[Archivo] color-[#111213] leading-normal" tag="div" scope="global" :keypath="$t('Roxy 充值福利月，最高 {bonus}', { bonus: '{bonus}' })">
        <template #bonus>
          <span class="color-[#FF7D00]">{{ $t('赠送 {value}', { value: `${maxBonus}%` }) }}</span>
        </template>
      </i18n-t>

      <div v-if="frontTiers.length >= 2 && lastTier" class="flex flex-col">
        <i18n-t class="text-3.5 font-500 leading-normal color-[#34393D]" tag="div" scope="global" :keypath="$t('充值 {range} 送 {value}', { range: frontTiers[0].range, value: '{value}' })">
          <template #value>
            <span class="font-600 color-[#FF7D00]">{{ frontTiers[0].discount }}%</span>
          </template>
        </i18n-t>
        <i18n-t class="text-3.5 font-500 leading-normal color-[#34393D]" tag="div" scope="global"
                :keypath="$t('充值 {range} 送 {value}', { range: frontTiers[1].range, value: '{value}' })"
        >
          <template #value>
            <span class="font-600 color-[#FF7D00]">{{ frontTiers[1].discount }}%</span>
          </template>
        </i18n-t>
        <i18n-t class="text-3.5 font-500 leading-normal color-[#34393D]" tag="div" scope="global" :keypath="$t('充值 {range} 及以上送 {value}', { range: lastTier.range, value: '{value}' })">
          <template #value>
            <span class="font-600 color-[#FF7D00]">{{ lastTier.discount }}%</span>
          </template>
        </i18n-t>
      </div>
    </div>
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
