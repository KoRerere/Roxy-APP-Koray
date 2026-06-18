<script setup lang="ts">
import currency from 'currency.js'
import { useCampaignStore } from '/@/stores/campaign'
import { getImage } from '/@/utils/basic'

const { amount } = defineProps<{
  amount: number
}>()

const { currentActivity, seasonalActivity } = storeToRefs(useCampaignStore())

const imageSrc = computed(() => {
  return `url(${getImage('campaing/june-eighteen/next_bg.png')})`
})

const nextBouns = computed(() => {
  const { recharge_benefits } = currentActivity.value
  const next = recharge_benefits.find(item => item.amount > amount)
  const data = next || recharge_benefits[recharge_benefits.length - 1]

  const much = currency(data.amount).subtract(amount).format()

  return {
    bouns: currency(next ? data.amount : amount).multiply(data.discount).divide(100).format(),
    text: next
      ? $t('还差 {much}，即可解锁 {value} 赠金', { much, value: '{value}' })
      : $t('当前可解锁高达 {value} 的赠金', { value: '{value}' }),
  }
})
</script>

<template>
  <div v-if="seasonalActivity.juneEighteen" class="flex items-center justify-center gap-2.5 py-2 px-3 rounded-1.5 bouns">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clip-path="url(#clip0_11161_40519)">
        <path fill-rule="evenodd" clip-rule="evenodd"
              d="M11.1423 9.4285C13.667 9.4285 15.7137 7.3818 15.7137 4.85707C15.7137 2.33234 13.667 0.285645 11.1423 0.285645C8.61757 0.285645 6.57087 2.33234 6.57087 4.85707C6.57087 7.3818 8.61757 9.4285 11.1423 9.4285ZM11.1423 2.99993C11.5368 2.99993 11.8566 3.31972 11.8566 3.71422V5.99993C11.8566 6.39442 11.5368 6.71422 11.1423 6.71422C10.7478 6.71422 10.428 6.39442 10.428 5.99993V3.71422C10.428 3.31972 10.7478 2.99993 11.1423 2.99993ZM2.39161 7.71422H0.285156V12.2856L2.37479 14.3752C3.23209 15.2326 4.39486 15.7142 5.60727 15.7142H12.2852C13.2319 15.7142 13.9994 14.9467 13.9994 13.9999C13.9994 13.0532 13.2319 12.2856 12.2852 12.2856H9.1116C9.00129 12.6588 8.79891 13.0104 8.50445 13.3048C7.56277 14.2466 6.036 14.2466 5.09432 13.3048L3.43717 11.6477C3.15822 11.3688 3.15822 10.9165 3.43717 10.6376C3.71612 10.3586 4.16838 10.3586 4.44732 10.6376L6.10448 12.2947C6.48826 12.6786 7.11051 12.6786 7.4943 12.2947C7.83943 11.9496 7.8742 11.4116 7.59857 11.0276L5.62409 9.05315C4.76679 8.19585 3.60402 7.71422 2.39161 7.71422Z"
              fill="url(#paint0_linear_11161_40519)"
        />
      </g>
      <defs>
        <linearGradient id="paint0_linear_11161_40519" x1="0.285156" y1="0.285645" x2="17.3853" y2="2.43873" gradientUnits="userSpaceOnUse">
          <stop stop-color="#05CAED" />
          <stop offset="1" stop-color="#47D769" />
        </linearGradient>
        <clipPath id="clip0_11161_40519">
          <rect width="16" height="16" fill="white" />
        </clipPath>
      </defs>
    </svg>
    <i18n-t class="color-white text-3" tag="div" scope="global" :keypath="nextBouns.text">
      <template #value>
        <span class="color-[#12cdd2] font-700">{{ nextBouns.bouns }}</span>
      </template>
    </i18n-t>
  </div>
</template>

<style lang="scss" scoped>
.bouns {
  background-image: v-bind(imageSrc);
  background-size: cover;
  background-repeat: no-repeat;
  background-position: top center;
}
</style>
