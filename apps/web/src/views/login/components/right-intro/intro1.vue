<script setup lang="ts">
import { motion } from 'motion-v';
import { RxSvgIcon } from '/@/components/rx-icon'
import { useThemeStore } from '/@/stores/theme'

const themeStore = useThemeStore()

const img = computed(() => {
  return `/images/login/${themeStore.realTheme}/multi-account.png`
})

</script>

<template>
  <div class="intro-section-1">
    <motion.div class="profiles" :initial="{ opacity: 0, y: 100 }" :animate="{ opacity: 1, y: 0 }"
      :transition="{ duration: 0.6, ease: [0, 0.71, 0.2, 1.01] }">
      <img :src="img" alt="" class="w-full">
    </motion.div>
    <motion.div class="facebook_logo front" :initial="{ opacity: 0, y: 300, rotate: 145 }"
      :animate="{ opacity: 1, y: 0, rotate: -15 }"
      :transition="{ duration: 0.6, ease: [0, 0.71, 0.2, 1.01], delay: 0.1 }">
      <RxSvgIcon name="websites/rx_site_facebook" size="120" />
    </motion.div>
    <motion.div class="facebook_logo middle" :initial="{ opacity: 0, y: 300, rotate: 145 }"
      :animate="{ opacity: 1, y: 0, rotate: 15 }"
      :transition="{ duration: 0.6, ease: [0, 0.71, 0.2, 1.01], delay: 0.1 }">
      <RxSvgIcon name="websites/rx_site_facebook" size="80" />
    </motion.div>
    <motion.div class="facebook_logo back" :initial="{ opacity: 0, y: 300, rotate: 145 }"
      :animate="{ opacity: 1, y: 0, rotate: -10 }"
      :transition="{ duration: 0.6, ease: [0, 0.71, 0.2, 1.01], delay: 0.2 }">
      <RxSvgIcon name="websites/rx_site_facebook" size="60" />
    </motion.div>
  </div>
</template>

<style lang="scss" scoped>
.intro-section-1 {
  .profiles {
    position: absolute;
    width: 1520px;
    left: 15%;
    top: 40%;
    z-index: 2;
  }

  .facebook_logo {
    position: absolute;

    &.front {
      left: 70%;
      bottom: 55%;
      transform: translateY(10%) rotate(-15deg);
      z-index: 4;
      width: 120px;
    }

    &.middle {
      bottom: 10%;
      left: 10%;
      width: 80px;
      transform: rotate(15deg);
      z-index: 3;
    }

    &.back {
      bottom: 45%;
      left: 11%;
      width: 60px;
      transform: rotate(-10deg);
      filter: blur(4px);
      z-index: 1;
    }
  }
}
</style>