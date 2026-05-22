<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import { motion } from 'motion-v'
import Marquee from './marquee.vue'
import { useThemeStore } from '/@/stores/theme'
import { useI18n } from '/@/locales'

const themeStore = useThemeStore()

// 6310 ad-strategy.svg
// -a----         2026/5/20     17:21           6617 affiliate-marketing.svg
// -a----         2026/5/20     17:21          12710 crypto-gains.svg
// -a----         2026/5/20     17:21           7991 e-commerce.svg
// -a----         2026/5/20     17:21          10025 privacy-protection.svg
// -a----         2026/5/20     17:21           6994 social-media.svg
// -a----         2026/5/20     17:21           8735 traffic-trade.svg
const { locale } = useI18n()

const zhImgs = [
  'ad-strategy',
  'affiliate-marketing',
  'crypto-gains',
  'e-commerce',
  'privacy-protection',
  'social-media',
  'traffic-trade',
  'web-acraping',
]

const zhHiddenImgs = ['crypto-gains']

function getMqImg(no: number, logo: string) {
  if (locale.value === 'zh-CN') {
    if (zhHiddenImgs.includes(logo)) {
      return null
    }
    if (zhImgs.includes(logo)) {
      return getImage(`login/${themeStore.realTheme}/${no}/zh/${logo}.svg`)
    }
  }

  return getImage(`login/${themeStore.realTheme}/${no}/${logo}.svg`)
}

const mqList = computed(() => {
  return [
    {
      list: ['alibaba', 'chatgpt', 'depop', 'disney', 'ebay', 'gemini', 'gmail', 'hbo', 'instagram', 'linkedin', 'netflix', 'telegram'].map(logo => getMqImg(1, logo)).filter(Boolean),
      imgClass: 'size-100px cover select-none',
      duration: 80,
    },
    {
      list: ['affiliate-marketing', 'facebook', 'crypto-gains', 'e-commerce', 'shopify', 'social-media'].map(logo => getMqImg(2, logo)).filter(Boolean),
      imgClass: 'h-89px cover select-none',
      duration: 120,
    },
    {
      list: ['alipay', 'grok', 'lazada', 'line', 'paypal', 'protonmail', 'reddit', 'shoplineapp', 'steam', 'stripe', 'tiktok', 'tinder', 'x', 'youtube'].map(logo => getMqImg(3, logo)).filter(Boolean),
      duration: 80,
      imgClass: 'size-100px cover select-none',
      reverse: true,
    },
    {
      list: ['ad-strategy', 'amazon', 'privacy-protection', 'traffic-trade', 'etsy', 'web-acraping', 'shopping'].map(logo => getMqImg(4, logo)).filter(Boolean),
      duration: 120,
      imgClass: 'h-89px cover select-none',
      reverse: true,
    },
  ]
})
</script>

<template>
  <div class="mt-100px min-[1440px]:mt-180px w-full select-none" draggable="false">
    <motion.div v-for="(mq, i) in mqList" :key="i" :initial="{ opacity: 0, y: 100 }" :animate="{ opacity: 1, y: 0 }"
                :transition="{ duration: 0.4, ease: [0, 0.71, 0.2, 1.01], delay: (i - 1) * 0.1 }"
    >
      <Marquee :reverse="mq.reverse" :duration="mq.duration">
        <img v-for="src in mq.list" :key="src" :src="src" :class="mq.imgClass" draggable="false">
      </Marquee>
    </motion.div>
  </div>
</template>
