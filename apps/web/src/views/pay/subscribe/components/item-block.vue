<script setup lang="ts">
interface Props {
  /** 区块标题；与 extra 同时存在时标题在左、extra 在右 */
  title?: string
}

defineProps<Props>()
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="title || $slots.extra" class="flex items-center justify-between gap-3">
      <div v-if="title" class="title">
        {{ title }}
      </div>
      <slot name="extra" />
    </div>
    <slot />
  </div>
</template>

<style scoped>
.title {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-size: 16px;
  font-weight: 700;
  line-height: normal;
}
</style>
