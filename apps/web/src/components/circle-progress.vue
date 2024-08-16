<script setup>
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
  <div class="circle-progress">
    <svg viewBox="0 0 36 36" :width="size" class="circular-chart">
      <path class="circle-bg" :stroke-width="strokeWidth" d="M18 2.0845
           a 15.9155 15.9155 0 0 1 0 31.831
           a 15.9155 15.9155 0 0 1 0 -31.831"
      />
      <path class="circle" :stroke-width="strokeWidth" :stroke-dasharray="`${value}, 100`" d="M18 2.0845
           a 15.9155 15.9155 0 0 1 0 31.831
           a 15.9155 15.9155 0 0 1 0 -31.831"
      />
    </svg>
  </div>
</template>

<style scoped>
.circular-chart {
  display: block;
}

.circle-bg {
  fill: none;
  stroke: #e4e8eb;
  stroke-linecap: round;
  transition: stroke-dasharray 0.3s ease-out;
}

.circle {
  fill: none;
  stroke: #1cc94d;
  stroke-linecap: round;
  transition: stroke-dasharray 0.3s ease-out;
}
</style>
