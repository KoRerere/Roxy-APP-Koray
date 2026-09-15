<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import { useCampaignStore } from '/@/stores/campaign'

const { seasonalActivity } = storeToRefs(useCampaignStore())

const imgSrc = `url('${getImage('campaing/mid-autumn-festival/subscribe_banner_bg.jpg')}')`

const giveAway = [
  $t('充值 {amount} 送 {giveAway}({discount})', { amount: 50, giveAway: 5, discount: 10 }),
  $t('充值 {amount} 送 {giveAway}({discount})', { amount: 100, giveAway: 20, discount: 20 }),
  $t('充值 {amount} 送 {giveAway}({discount})', { amount: 500, giveAway: 150, discount: 30 }),
  $t('充值 {amount} 送 {giveAway}({discount})', { amount: 1000, giveAway: 400, discount: 40 }),
]
</script>

<template>
  <div v-if="seasonalActivity.midAutumnFestival" class="h-33 relative flex flex-col justify-center gap-1.5 py-3.5 px-4 rounded-2 overflow-hidden banner">
    <div class="flex items-center gap-2">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M3.61865 6.0001V11.6063C3.61865 12.2438 3.8699 12.8551 4.3199 13.3051L11.5199 20.5051C12.4574 21.4426 13.9762 21.4426 14.9137 20.5051L20.5199 14.8988C21.4574 13.9613 21.4574 12.4426 20.5199 11.5051L13.3199 4.3051C12.8699 3.85135 12.2624 3.6001 11.6249 3.6001H6.01865C4.6949 3.6001 3.61865 4.67635 3.61865 6.0001ZM7.81865 6.6001C8.4824 6.6001 9.01865 7.13635 9.01865 7.8001C9.01865 8.46385 8.4824 9.0001 7.81865 9.0001C7.1549 9.0001 6.61865 8.46385 6.61865 7.8001C6.61865 7.13635 7.1549 6.6001 7.81865 6.6001Z"
          fill="url(#paint0_linear_12789_96855)"
        />
        <defs>
          <linearGradient id="paint0_linear_12789_96855" x1="4.13643" y1="1.94934" x2="21.8381" y2="20.6883" gradientUnits="userSpaceOnUse">
            <stop stop-color="#FFF0A7" />
            <stop offset="0.5" stop-color="#F4C456" />
            <stop offset="1" stop-color="#B97624" />
          </linearGradient>
        </defs>
      </svg>
      <div class="title">
        {{ $t('充值返利 · 满送大酬宾') }}
      </div>
    </div>
    <i18n-t class="color-white text-3.25  leading-4.5" tag="div" scope="global" :keypath="$t('充值越多，返利越高！最高 {discount} 充值金额', { discount: '{discount}' })">
      <template #discount>
        <span class="font-600 bouns">{{ $t('赠送 {discount}%', { discount: 40 }) }}</span>
      </template>
    </i18n-t>
    <div class="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1">
      <div v-for="item in giveAway" :key="item" class="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
        <SvgIcon name="base/rx_ic_check_line" color="var(--colors-icon-icon-success)" />
        <span class="color-white/90 text-3 leading-4.5">{{ item }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.banner {
  background-image: v-bind(imgSrc);
  background-size: auto 100%;
  background-position: top right;
  background-repeat: no-repeat;
}

.title {
  font-size: 18px;
  font-weight: 700;
  line-height: 120%;
  background: linear-gradient(180deg, #fbd99b 30.17%, #fcc67e 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.bouns {
  background: linear-gradient(180deg, #fbd99b 30.17%, #fcc67e 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>
