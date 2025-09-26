<script lang="ts" setup>
interface Props {
  value?: number | string
  size?: number | string
  strokeWidth?: number | string
}

const { value = 0, strokeWidth = 2, size = 32 } = defineProps<Props>()

const viewboxSize = computed(() => Number(size) + Number(strokeWidth))
const viewboxString = computed(() => `0 0 ${viewboxSize.value} ${viewboxSize.value}`)
const center = computed(() => viewboxSize.value / 2)
const radius = computed(() => {
  const padding = Math.max(1, viewboxSize.value * 0.03)
  return center.value - padding - Number(strokeWidth) / 2
})
const pathString = computed(() => {
  const r = radius.value
  const c = center.value
  return `M${c} ${c - r}
           a ${r} ${r} 0 0 1 0 ${2 * r}
           a ${r} ${r} 0 0 1 0 ${-2 * r}`
})

const dashArray = computed(() => {
  const circumference = 2 * Math.PI * radius.value
  const progress = (Number(value) / 100) * circumference
  return `${progress}, ${circumference}`
})

const strokeLinecap = computed(() => Number(value) <= 2 ? 'butt' : 'round')
</script>

<template>
  <div>
    <svg :viewBox="viewboxString" :width="size" class="block">
      <path class="circle-bg" :stroke-width="strokeWidth" :d="pathString" />
      <path class="circle-val" :stroke-width="strokeWidth" :stroke-dasharray="dashArray" :stroke-linecap="strokeLinecap" :d="pathString" />
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
  transition: stroke-dasharray 0.3s ease-out;
}
</style>
