<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon'
import { useThemeStore } from '/@/stores/theme'
import { motion } from 'motion-v'

const themeStore = useThemeStore()

const img1 = computed(() => {
  return `/images/login/${themeStore.realTheme}/team-space.png`
})

const img2 = computed(() => {
  return `/images/login/${themeStore.realTheme}/invite.png`
})
// :animate="{
//       x: [0, 100, 200, 0],
//       y: [0, 100, 0, 0],
//     }" :transition="{
//       duration: 5,
//       times: [0, 0.5, 1],
//       repeat: Infinity,
//     }"
</script>

<template>
  <div class="absolute w-707px right-0 bottom-0">
    <img :src="img1" alt="" class="w-full">
    <motion.div class="absolute top-20px left-40%" :animate="{
      x: [0, 100, 200, 0],
      y: [0, 100, 0, 0],
    }" :transition="{
      duration: 5,
      times: [0, 0.5, 1],
      repeat: Infinity,
    }">
      <RxSvgIcon name="base/rx_ic_cursor_autoclick" color="#BC62DA" size="24" class="-rotate-15" />
      <div
        class="absolute top-20px left-20px w-80px h-36px bg-[#BC62DA] color-white font-[Inter] text-18px text-center leading-36px rounded-6px">
        Lazar</div>
    </motion.div>
  </div>
  <div class="absolute w-480px left-53px bottom-0">
    <img :src="img2" alt="" class="w-full">
    <motion.div class="absolute top-20px left-20%" :animate="{
      x: [0, 100, 100, 0, 0],
      y: [0, 0, 100, 100, 0],
    }" :transition="{
      duration: 5,
      times: [0, 0.5, 1],
      repeat: Infinity,
    }">
      <RxSvgIcon name="base/rx_ic_cursor_autoclick" color="#D1F967" size="24" class="-rotate-15" />
      <div
        class="absolute top-20px left-20px w-80px h-36px bg-[#D1F967] color-[#111213] font-[Inter] text-18px text-center leading-36px rounded-6px">
        Exlipso
      </div>
    </motion.div>
  </div>
</template>
