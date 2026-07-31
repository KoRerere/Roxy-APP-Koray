<script setup lang="ts">
const { data } = defineProps<{
  data: any
}>()
</script>

<template>
  <div v-if="data.windowPlatformList[0]" class="flex items-center gap-3">
    <div class="w-7.5 aspect-square flex items-center justify-center rounded-1.5 image">
      <RxImage class="block w-4.5" :src="data.windowPlatformList[0].platformIcon" :dark-src="data.windowPlatformList[0].platformIconDark" />
    </div>
    <div class="flex flex-col gap-1">
      <div class="tt-primary text-3 leading-4">
        {{ data.windowName }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.image {
  border: 0.5px solid var(--colors-border-border-base, #afb7bb);
  background: var(--colors-background-bg-action, #fff);
  box-shadow:
    0 4px 4px -1px rgba(0, 0, 0, 0.02),
    0 1px 1px 0 rgba(0, 0, 0, 0.06);
}
</style>
