<script setup lang="ts">
import { motion } from 'motion-v';
import { RxSvgIcon } from '/@/components/rx-icon'
</script>

<template>
  <div class="intro-section-2">
    <div class="profiles_sync">
      <motion.div v-for="i in 4" :key="i" class="facebook_frame" :initial="{ opacity: 0, y: 300 }"
        :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.8, ease: [0, 0.71, 0.2, 1.01], delay: (i - 1) * 0.1 }">
        <img src="/images/login/facebook_2x.webp" alt="" class="facebook_content">
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
  </div>
</template>

<style lang="scss" scoped>
.intro-section-2 {
  .profiles_sync {
    position: absolute;
    top: 40%;
    left: 10%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 32px;
    width: 1000px;

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
        // mix-blend-mode: overlay;
      }

      &:nth-child(1) {
        background-color: #0766FF;

        &:after {
          display: none;
        }
      }

      img {
        position: relative;
        padding: 24px 8px 8px 8px;
        display: block;
        width: 100%;
        z-index: 1;
      }
    }
  }
}
</style>