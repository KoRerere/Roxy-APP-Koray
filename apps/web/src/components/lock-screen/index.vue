<template>
  <motion.div 
    :animate="{ scale: lockStore.isLocked ? 0.98 : 1 }" 
    :transition="{ duration: 0.25, ease: 'easeInOut' }"
  >
    <slot />
  </motion.div> 
  <LockScreenMark />
</template>

<script setup lang="ts">
import { motion } from 'motion-v';
import LockScreenMark from './screen.vue'
import { useLock } from '/@/stores/lock'

const lockStore = useLock()
</script>

<style scoped lang="scss">

</style>
