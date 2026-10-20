<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import { useCampaignStore } from '/@/stores/campaign'

const { type } = defineProps<{
  type: 'point' | 'proxy'
}>()

const { seasonalActivity } = storeToRefs(useCampaignStore())

const imgSrc = computed(() => {
  return type === 'point'
    ? `url('${getImage('campaing/mid-autumn-festival/point_banner_bg.jpg')}')`
    : `url('${getImage('campaing/mid-autumn-festival/proxy_banner_bg.jpg')}')`
})
</script>

<template>
  <div v-if="seasonalActivity.midAutumnFestival" class="flex items-center gap-1.5 py-3.5 px-4 rounded-2 overflow-hidden banner">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M11.1074 13.0552V22.2778H5.66699C4.56242 22.2778 3.66699 21.3824 3.66699 20.2778V13.0552H11.1074ZM20.333 20.2778C20.333 21.3824 19.4376 22.2778 18.333 22.2778H12.8398V13.0552H20.333V20.2778ZM20.6113 7.27783C20.9796 7.27789 21.3324 7.42464 21.5928 7.68506C21.8532 7.94547 21.9999 8.29823 22 8.6665V11.7222H12.8398V7.27783H20.6113ZM11.1074 11.7222H2V8.6665C2.00006 8.29823 2.14681 7.94547 2.40723 7.68506C2.66764 7.42464 3.02039 7.27789 3.38867 7.27783H11.1074V11.7222Z"
        fill="url(#paint0_linear_12781_96018)"
      />
      <path
        d="M15.7773 1.72217C17.3413 1.72217 18.6668 2.81249 18.667 4.49951C18.667 5.80721 17.8536 6.71916 16.791 7.27783H7.20898C6.14633 6.71915 5.33301 5.80732 5.33301 4.49951C5.33324 2.81265 6.65789 1.72238 8.22168 1.72217C9.6718 1.72217 10.7545 2.65951 11.4551 3.70264C11.6612 4.00962 11.8416 4.33952 12 4.6792C12.1582 4.33961 12.3379 4.00951 12.5439 3.70264C13.2445 2.65961 14.3274 1.72235 15.7773 1.72217ZM8.22168 3.38916C7.45292 3.38935 7.0002 3.85381 7 4.49951C7 5.01945 7.31359 5.50949 8.18164 5.8999C8.86139 6.20553 9.7902 6.3941 10.877 6.43994C10.7045 5.81086 10.4315 5.16763 10.0713 4.63135C9.52194 3.81354 8.8826 3.38916 8.22168 3.38916ZM15.7773 3.38916C15.1165 3.38934 14.477 3.81356 13.9277 4.63135C13.5675 5.16773 13.2935 5.81078 13.1211 6.43994C14.2084 6.39424 15.1373 6.20558 15.8174 5.8999C16.6857 5.50946 17 5.01951 17 4.49951C16.9998 3.85368 16.5464 3.38916 15.7773 3.38916Z"
        fill="url(#paint1_linear_12781_96018)"
      />
      <defs>
        <linearGradient id="paint0_linear_12781_96018" x1="4.22222" y1="3.38894" x2="20.3333" y2="22.8334" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FFF1B5" />
          <stop offset="0.48" stop-color="#F5C65C" />
          <stop offset="1" stop-color="#B87324" />
        </linearGradient>
        <linearGradient id="paint1_linear_12781_96018" x1="9.22225" y1="6.72217" x2="14.7778" y2="22.8333" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FFF7CF" />
          <stop offset="1" stop-color="#D99B35" />
        </linearGradient>
      </defs>
    </svg>
    <div class="title">
      {{ $t('购买代理 IP · 下单即抽奖') }}
    </div>
    <div class="rewards">
      {{ $t('100% 中奖') }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
.banner {
  background-image: v-bind(imgSrc);
  /* 容器比背景图宽时（如半屏布局）等比放大铺满，避免左侧露白 */
  background-size: cover;
  background-position: right center;
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

.rewards {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 10000px;
  background: linear-gradient(90deg, #b5cefe 0%, #d0b4fc 100%);
  color: #272e3b;
  font-family: 'DingTalk JinBuTi';
  font-size: 14px;
  line-height: 140%;
}
</style>
