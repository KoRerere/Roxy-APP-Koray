<script setup lang="ts">
import { motion } from 'motion-v';
</script>

<template>
  <div class="intro-section-2">
    <div class="profiles_sync">
      <motion.div class="facebook_frame" :initial="{ opacity: 0, y: 300 }" :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.8, ease: [0, 0.71, 0.2, 1.01] }">
        <img src="/images/login/facebook_2x.webp" alt="" class="facebook_content">
      </motion.div>
      <motion.div class="facebook_frame" :initial="{ opacity: 0, y: 300 }" :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.8, ease: [0, 0.71, 0.2, 1.01], delay: 0.1 }">
        <img src="/images/login/facebook_2x.webp" alt="" class="facebook_content">
      </motion.div>
      <motion.div class="facebook_frame" :initial="{ opacity: 0, y: 300 }" :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.8, ease: [0, 0.71, 0.2, 1.01], delay: 0.2 }">
        <img src="/images/login/facebook_2x.webp" alt="" class="facebook_content">
      </motion.div>
      <motion.div class="facebook_frame" :initial="{ opacity: 0, y: 300 }" :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.8, ease: [0, 0.71, 0.2, 1.01], delay: 0.3 }">
        <img src="/images/login/facebook_2x.webp" alt="" class="facebook_content">
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