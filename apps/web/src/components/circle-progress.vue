<script lang="ts" setup>
defineProps({
  value: {
    type: [Number, String],
    default: 0,
  },
  size: {
    type: [Number, String],
    default: 32,
  },
  strokeWidth: {
    type: [Number, String],
    default: 2,
  },
})
</script>

<template>
  <div>
    <svg viewBox="0 0 36 36" :width="size" class="block">
      <path class="circle-bg" :stroke-width="strokeWidth" d="M18 2.0845
           a 15.9155 15.9155 0 0 1 0 31.831
           a 15.9155 15.9155 0 0 1 0 -31.831" />
      <path class="circle-val" :stroke-width="strokeWidth" :stroke-dasharray="`${value}, 100`" d="M18 2.0845
           a 15.9155 15.9155 0 0 1 0 31.831
           a 15.9155 15.9155 0 0 1 0 -31.831" />
    </svg>
  </div>
</template>

<style scoped>
.circle-bg {
  fill: none;
  stroke: var(--component-progress-bg);
  stroke-linecap: round;
  transition: stroke-dasharray 0.3s ease-out;
}

.circle-val {
  fill: none;
  stroke: var(--component-progress-success);
  stroke-linecap: round;
  transition: stroke-dasharray 0.3s ease-out;
}
</style>
