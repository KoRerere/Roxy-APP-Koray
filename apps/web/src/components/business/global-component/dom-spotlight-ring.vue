<script setup lang="ts">
import { computed } from 'vue'
import { domSpotlightActive, domSpotlightRingStyle } from '/@/hooks/useDomSpotlight'

const spotlightVisible = computed(() => domSpotlightActive.value)
</script>

<template>
  <Teleport to="body">
    <div v-if="spotlightVisible" class="dom-spotlight-ring" :style="domSpotlightRingStyle" aria-hidden="true" />
  </Teleport>
</template>

<style scoped>
.dom-spotlight-ring {
  position: fixed;
  z-index: 10001;
  box-sizing: border-box;
  pointer-events: none;
  box-shadow:
    0 0 0 4px rgba(102, 126, 234, 0.8),
    0 0 0 8px rgba(102, 126, 234, 0.4),
    0 0 30px 15px rgba(102, 126, 234, 0.6);
  animation: dom-spotlight-ring-pulse 2s ease-in-out infinite;
  will-change: box-shadow;
}

@keyframes dom-spotlight-ring-pulse {
  0%,
  100% {
    box-shadow:
      0 0 0 4px rgba(102, 126, 234, 0.8),
      0 0 0 8px rgba(102, 126, 234, 0.4),
      0 0 30px 15px rgba(102, 126, 234, 0.6);
  }

  50% {
    box-shadow:
      0 0 0 6px rgba(102, 126, 234, 1),
      0 0 0 12px rgba(102, 126, 234, 0.6),
      0 0 50px 25px rgba(102, 126, 234, 0.8);
  }
}
</style>
