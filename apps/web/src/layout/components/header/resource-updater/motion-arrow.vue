<script setup lang="ts">
import { motion } from 'motion-v';
import { useThemeStore } from '/@/stores/theme'

const themeStore = useThemeStore()
const HOLD = 2400
const timeId = ref()
const iconParts = ref([
  {
    icon: '/images/update/update_top.svg',
    darkIcon: '/images/update/update_top-dark.svg',
    initial: { y: 6, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    transition: { delay: 0.3, duration: 0.3 }
  },
  {
    icon: '/images/update/update_middle.svg',
    darkIcon: '/images/update/update_middle-dark.svg',
    initial: { y: 6, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    transition: { delay: 0.1, duration: 0.3 }
  },
  {
    icon: '/images/update/update_bottom.svg',
    darkIcon: '/images/update/update_bottom-dark.svg',
    initial: { y: 6, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    transition: { delay: 0, duration: 0.3 }
  },
])

onMounted(() => {
  startAnimationCycle()
})

onUnmounted(() => {
  clearTimeout(timeId.value)
})

function startAnimationCycle() {
  // 第一阶段：进入动画
  iconParts.value.forEach((part, index) => {
    part.animate = { y: 0, opacity: 1 }
    part.transition = { delay: (2 - index) * 0.1, duration: 0.3 }
  })

  // 等待进入动画完成（0.2 + 0.3 = 0.5秒）+ 3秒停留时间
  timeId.value = setTimeout(() => {
    iconParts.value.forEach(part => {
      part.animate = { y: 6, opacity: 0 }
      part.transition = { delay: 0, duration: 0.3 }
    })
    // 等待退出动画完成后重新开始循环
    timeId.value = setTimeout(() => {
      startAnimationCycle();
    }, 300); // 0.5秒退出动画完成后

  }, HOLD + 300); // 0.5秒进入动画 + 3秒停留时间
}
</script>

<template>
  <div class="w-16 flex flex-col gap-1 py-4">
    <motion.div class="w-full" v-for="item in iconParts" :initial="item.initial" :animate="item.animate" :transition="item.transition">
      <img class="block w-full" :src="themeStore.realTheme === 'light' ? item.icon : item.darkIcon">
    </motion.div>
  </div>
</template>

<style scoped></style>