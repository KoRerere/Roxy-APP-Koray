<script setup lang="ts">
import Choose from './choose.vue'
import ECommerce from './e-commerce.vue'
import Proxy from './proxy.vue'
// import { $t } from '/@/locales'
import { AnimatePresence, motion } from 'motion-v'

const emit = defineEmits<{
  close: []
}>()

const type = ref<'commerce' | 'proxy' | 'normal'>()
const platform = ref()

function onNext(nextType: 'commerce' | 'proxy' | 'normal') {
  if (nextType === 'normal') {
    emit('close')
    return
  }

  type.value = nextType
}
</script>

<template>
  <AnimatePresence>
    <motion.div class="w-screen h-screen lock-screen-overlay" :initial="{ opacity: 0, scale: 0.98 }" :animate="{ opacity: 1, scale: 1 }" :exit="{ opacity: 0, scale: 0.98 }"
                :transition="{ duration: 0.25, ease: 'easeInOut' }"
    >
      <Choose v-if="!type" @close="$emit('close')" @next="onNext" />
      <ECommerce v-if="type === 'commerce'" v-model="platform" @close="$emit('close')" @next="onNext" />
      <Proxy v-if="type === 'proxy'" />
    </motion.div>
  </AnimatePresence>
</template>

<style scoped lang="scss">
.lock-screen-overlay {
  background: var(--colors-background-bg-overlay);
  display: flex !important;
  justify-content: center;
  align-items: center;
}
</style>
