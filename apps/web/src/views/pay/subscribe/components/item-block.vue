<script setup lang="ts">
interface Props {
  title: string
}

defineProps<Props>()
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="title">
      {{ title }}
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
