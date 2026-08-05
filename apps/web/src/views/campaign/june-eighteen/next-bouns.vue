<script setup lang="ts">
import currency from 'currency.js'
import { useCampaignStore } from '/@/stores/campaign'
import { getImage } from '/@/utils/basic'

const { amount } = defineProps<{
  amount: number
}>()

const { currentActivity, seasonalActivity } = storeToRefs(useCampaignStore())

const imageSrc = computed(() => {
  return `url(${getImage('campaing/june-eighteen/next.png')})`
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
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <g clip-path="url(#clip0_11532_66320)">
        <path fill-rule="evenodd" clip-rule="evenodd"
              d="M11.1443 9.42865C13.6689 9.42865 15.7157 7.38196 15.7157 4.85723C15.7157 2.33249 13.6689 0.285797 11.1443 0.285797C8.61952 0.285797 6.57282 2.33249 6.57282 4.85723C6.57282 7.38196 8.61952 9.42865 11.1443 9.42865ZM11.1443 3.00008C11.5388 3.00008 11.8585 3.31988 11.8585 3.71437V6.00008C11.8585 6.39457 11.5388 6.71437 11.1443 6.71437C10.7498 6.71437 10.43 6.39457 10.43 6.00008V3.71437C10.43 3.31988 10.7498 3.00008 11.1443 3.00008ZM2.39357 7.71437H0.287109V12.2858L2.37674 14.3754C3.23405 15.2328 4.39681 15.7144 5.60922 15.7144H12.2871C13.2339 15.7144 14.0014 14.9468 14.0014 14.0001C14.0014 13.0533 13.2339 12.2858 12.2871 12.2858H9.11355C9.00325 12.6589 8.80086 13.0106 8.5064 13.305C7.56472 14.2467 6.03796 14.2467 5.09628 13.305L3.43912 11.6479C3.16017 11.3689 3.16017 10.9167 3.43912 10.6377C3.71807 10.3588 4.17033 10.3588 4.44927 10.6377L6.10644 12.2948C6.49022 12.6787 7.11246 12.6787 7.49625 12.2948C7.84138 11.9498 7.87615 11.4118 7.60053 11.0278L5.62605 9.05331C4.76874 8.196 3.60598 7.71437 2.39357 7.71437Z"
              fill="url(#paint0_linear_11532_66320)"
        />
      </g>
      <defs>
        <linearGradient id="paint0_linear_11532_66320" x1="0.5" y1="9.11038e-08" x2="15.5" y2="16" gradientUnits="userSpaceOnUse">
          <stop stop-color="#92D5FF" />
          <stop offset="1" stop-color="#11A3FD" />
        </linearGradient>
        <clipPath id="clip0_11532_66320">
          <rect width="16" height="16" fill="white" />
        </clipPath>
      </defs>
    </svg>
    <i18n-t class="color-[#111213] text-3" tag="div" scope="global" :keypath="nextBouns.text">
      <template #value>
        <span class="color-[#FF7D00] font-700">{{ nextBouns.bouns }}</span>
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
