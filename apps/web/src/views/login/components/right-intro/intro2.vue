<script setup lang="ts">
import { motion } from 'motion-v';
import { RxSvgIcon } from '/@/components/rx-icon'
import { useThemeStore } from '/@/stores/theme'

const themeStore = useThemeStore()

const img = computed(() => {
  return `/images/login/${themeStore.realTheme}/profile-sync.png`
})
</script>

<template>
  <motion.div class="flex justify-center mt-70px sync-ctrl" :initial="{ opacity: 0, y: 100 }"
    :animate="{ opacity: 1, y: 0 }" :transition="{ duration: 0.5, ease: [0, 0.71, 0.2, 1.01] }">
    <div
      class="bg-[var(--colors-alpha-alpha-black-60)] rounded-12px w-440px h-55px flex items-center justify-between pl-24px pr-10px after:content-[''] after:w-86px after:h-35px  after:bg-white/20 after:rounded-8px">
      4 profiles syncing...
    </div>
  </motion.div>

  <div class="profiles_sync mt-36px">
    <motion.div v-for="i in 4" :key="i" class="facebook_frame" :initial="{ opacity: 0, y: 300 }"
      :animate="{ opacity: 1, y: 0 }" :transition="{ duration: 0.8, ease: [0, 0.71, 0.2, 1.01], delay: (i - 1) * 0.1 }">
      <img :src="img" alt="" class="facebook_content">
      <motion.div class="absolute top-20px left-20px z-10" :animate="{
        x: [0, 50, 100, 0],
        y: [0, 50, 0, 0],
      }" :transition="{
        duration: 5,
        times: [0, 0.5, 1],
        repeat: Infinity,
      }">
        <RxSvgIcon name="base/rx_ic_cursor_autoclick" color="#BC62DA" size="24" class="-rotate-15" />
      </motion.div>
    </motion.div>
  </div>
</template>

<style lang="scss" scoped>
.sync-ctrl,
.profiles_sync {
  width: 988px;
  margin-left: 100px;
}

.profiles_sync {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 24px 28px;

  .facebook_frame {
    overflow: hidden;
    border-radius: 16px;
    position: relative;

    &:after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      display: block;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.2);
      z-index: 0;
    }

    img {
      position: relative;
      display: block;
      width: 100%;
      z-index: 1;
      opacity: 0.5;
    }
  }

  .facebook_frame:nth-child(1) {
    img {
      opacity: 1;
    }
  }
}
</style>