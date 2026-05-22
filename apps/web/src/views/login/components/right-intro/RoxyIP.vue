<script setup lang="ts">
// import Cobe from '/@/components/business/roxy-ip/cobe.vue'
import { motion } from 'motion-v'
// import { useThemeStore } from '/@/stores/theme'

// import { getImage } from '/@/utils/basic'

// const themeStore = useThemeStore()

// const img = computed(() => {
//   return getImage(`login/${themeStore.realTheme}/earth.jpg`)
// })
</script>

<template>
  <motion.div
    class="roxy-ip-panel"
    :initial="{ opacity: 0, y: 40 }"
    :animate="{ opacity: 1, y: 0 }"
    :transition="{ duration: 0.6, ease: [0, 0.71, 0.2, 1.01] }"
  >
    <Cobe />
  </motion.div>
</template>

<style lang="scss" scoped>
.roxy-ip-panel {
  position: absolute;
  // left: 111px;
  // top: 323px;
  right: -100px;
  bottom: 0;
  // width: min(994px, calc(100% - 111px));
  // height: min(820px, calc(100% - 323px));
  height: calc(100% - 260px);
  min-height: 320px;
  aspect-ratio: 1 / 1;
  pointer-events: none;

  :deep(.cobe-canvas) {
    pointer-events: auto;
  }
}
</style>
