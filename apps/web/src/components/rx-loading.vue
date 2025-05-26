<script setup lang="ts">
interface Props {
  opacity?: number
  size?: number
}

const { opacity = 0.7, size = 32 } = defineProps<Props>()

const loading = defineModel<boolean>('modelValue', { required: true })

const iconSize = computed(() => Number.isNaN(Number(size)) ? size : CSS.px(size as number).toString())
</script>

<template>
  <div v-if="loading" class="absolute inset-0 flex items-center justify-center z-10 select-none">
    <div class="absolute inset-0 z-1 mask"></div>
    <img class="block mx-auto loading-circle z-2 loading-icon" src="/@/assets/images/status/loading.png">
  </div>
</template>

<style scoped lang="scss">
:where(.mask) {
  background-color: var(--colors-background-bg-page);
  opacity: v-bind(opacity);
}

:where(.loading-icon) {
  width: v-bind(iconSize);
  aspect-ratio: 1;
}
</style>
