<script setup lang="ts">
import { motion } from 'motion-v'
import Marquee from './marquee.vue'
import { useThemeStore } from '/@/stores/theme'

const themeStore = useThemeStore()

const mqList = computed(() => {
  return [
    {
      list: ['alibaba', 'chatgpt', 'depop', 'disney', 'ebay', 'gemini', 'gmail', 'hbo', 'instagram', 'linkedin', 'netflix', 'telegram'].map(logo => `/images/login/${themeStore.realTheme}/1/${logo}.svg`),
      imgClass: 'size-100px cover select-none',
      duration: '![--duration:80s]',
    },
    {
      list: ['affiliate-marketing', 'facebook', 'crypto-gains', 'e-commerce', 'shopify', 'social-media'].map(logo => `/images/login/${themeStore.realTheme}/2/${logo}.svg`),
      imgClass: 'h-89px cover select-none',
      duration: '![--duration:120s]',
    },
    {
      list: ['alipay', 'grok', 'lazada', 'line', 'paypal', 'protonmail', 'reddit', 'shoplineapp', 'steam', 'stripe', 'tiktok', 'tinder', 'x', 'youtube'].map(logo => `/images/login/${themeStore.realTheme}/3/${logo}.svg`),
      duration: '![--duration:80s]',
      imgClass: 'size-100px cover select-none',
      reverse: true
    },
    {
      list: ['ad-strategy', 'amazon', 'privacy-protection', 'traffic-trade', 'etsy', 'web-acraping'].map(logo => `/images/login/${themeStore.realTheme}/4/${logo}.svg`),
      duration: '![--duration:120s]',
      imgClass: 'h-89px cover select-none',
      reverse: true
    }
  ]
})

</script>

<template>
  <div class="mt-100px w-full select-none" draggable="false">
    <motion.div v-for="(mq, i) in mqList" :initial="{ opacity: 0, y: 100 }" :animate="{ opacity: 1, y: 0 }"
      :transition="{ duration: 0.4, ease: [0, 0.71, 0.2, 1.01], delay: (i - 1) * 0.1 }">
      <Marquee :reverse="mq.reverse" :class="mq.duration">
        <img v-for="i in mq.list" :src="i" :class="mq.imgClass">
      </Marquee>
    </motion.div>
  </div>
</template>