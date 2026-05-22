<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import { motion } from 'motion-v'
import { RxSvgIcon } from '/@/components/rx-icon'
import { useThemeStore } from '/@/stores/theme'
import { useI18n } from '/@/locales'

const { locale } = useI18n()
const themeStore = useThemeStore()

const img = computed(() => {
  return getImage(`login/${themeStore.realTheme}/profile-sync.png`)
})
</script>

<template>
  <motion.div class="flex justify-center mt-70px sync-ctrl select-none" :initial="{ opacity: 0, y: -100 }"
              :animate="{ opacity: 1, y: 0 }" :transition="{ duration: 0.5, ease: [0, 0.71, 0.2, 1.01] }"
  >
    <div
      class="bg-[var(--colors-alpha-alpha-black-60)] text-white rounded-12px w-360px text-14px h-55px flex items-center justify-between pl-24px pr-10px after:content-[''] after:w-86px after:h-35px  after:bg-white/20 after:rounded-8px"
    >
      {{ locale === 'zh-CN' ? '4 个窗口正在同步中...' : '4 profiles syncing...' }}
    </div>
  </motion.div>

  <div class="profiles_sync mt-36px select-none">
    <motion.div v-for="i in 4" :key="i" class="facebook_frame" :initial="{ opacity: 0, y: 300 }"
                :animate="{ opacity: 1, y: 0 }" :transition="{ duration: 0.8, ease: [0, 0.71, 0.2, 1.01], delay: (i - 1) * 0.1 }"
    >
      <img :src="img" alt="" class="facebook_content select-none" draggable="false">
      <motion.div class="absolute top-25% left-120px z-10" :animate="{
        x: [0, 90, 90, 90, 0],
        y: [0, 20, 40, 80, 0],
      }" :transition="{
        duration: 5,
        times: [0, 0.5, 1],
        repeat: Infinity,
      }"
      >
        <RxSvgIcon name="base/rx_ic_cursor_autoclick" color="#000" size="24" class="-rotate-15" />
        <div v-if="i === 1"
             class="absolute top-20px left-20px bg-[#0766FF] color-white font-[Inter] text-14px xxl:text-18px text-nowrap py-4px px-16px text-center leading-[1.6] rounded-6px select-none"
        >
          {{ locale === 'zh-CN' ? '主控窗口' : 'Main Control' }}
        </div>
      </motion.div>
    </motion.div>
  </div>
</template>

<style lang="scss" scoped>
.sync-ctrl,
.profiles_sync {
  width: 800px;
  margin-left: 100px;
}

@media (min-width: 1440px) {
  .sync-ctrl,
  .profiles_sync {
    width: 988px;
  }
}

.profiles_sync {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 24px 28px;

  .facebook_frame {
    overflow: hidden;
    position: relative;

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
