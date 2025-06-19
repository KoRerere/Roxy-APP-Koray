<script setup lang="ts">
import Marquee from './marquee.vue'
import { useThemeStore } from '/@/stores/theme'

const themeStore = useThemeStore()

const mq1 = computed(() => {
  return ['alibaba', 'chatgpt', 'depop', 'disney', 'ebay', 'gemini', 'gmail', 'hbo', 'instagram', 'linkedin', 'netflix', 'telegram'].map(logo => `/images/login/${themeStore.realTheme}/1/${logo}.svg`)
})

const mq2 = computed(() => {
  return ['affiliate-marketing', 'crypto-gains', 'e-commerce', 'facebook', 'shopify', 'social-media'].map(logo => `/images/login/${themeStore.realTheme}/2/${logo}.svg`)
})

const mq3 = computed(() => {
  return ['alipay', 'grok', 'lazada', 'line', 'paypal', 'protonmail', 'reddit', 'shoplineapp', 'steam', 'stripe', 'tiktok', 'tinder', 'x', 'youtube'].map(logo => `/images/login/${themeStore.realTheme}/3/${logo}.svg`)
})

const mq4 = computed(() => {
  return ['ad-strategy', 'amazon', 'etsy', 'privacy-protection', 'traffic-trade', 'web-acraping'].map(logo => `/images/login/${themeStore.realTheme}/4/${logo}.svg`)
})

</script>

<template>
  <div class="mt-160px w-full">
    <Marquee>
      <img v-for="i in mq1" :key="i" :src="i" alt="" class="size-100px cover">
    </Marquee>

    <Marquee>
      <img v-for="i in mq2" :key="i" :src="i" alt="" class="h-89px cover">
    </Marquee>

    <Marquee reverse class="![--duration:20s]">
      <img v-for="i in mq3" :key="i" :src="i" alt="" class="size-100px cover">
    </Marquee>

    <Marquee reverse class="![--duration:30s]">
      <img v-for="i in mq4" :key="i" :src="i" alt="" class="h-89px cover">
    </Marquee>
  </div>
</template>