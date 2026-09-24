<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import { useCampaignStore } from '/@/stores/campaign'

const { seasonalActivity, currentActivity } = storeToRefs(useCampaignStore())

const imgSrc = `url('${getImage('campaing/mid-autumn-festival/member_banner_bg.jpg')}')`
</script>

<template>
  <div v-if="seasonalActivity.midAutumnFestival && currentActivity.team_bogo" class="flex flex-col gap-1.5 py-3.5 px-4 rounded-2 overflow-hidden banner">
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
        {{ $t('团队席位 · 买 {count} 送 {count}', { count: 1 }) }}
      </div>
    </div>
    <div class="color-white text-3.25 font-600 leading-4.5">
      {{ $t('团队、团队成员均参与 · 购买及赠送均终身有效') }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
.banner {
  background-image: v-bind(imgSrc);
  background-size: 100% auto;
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
</style>
