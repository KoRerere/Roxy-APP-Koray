<script setup lang="ts">
defineProps<{
  html: string
}>()
</script>

<template>
  <div class="updater-content" v-html="html" />
</template>

<style lang="scss" scoped>
.updater-content {
  :deep(ul, p) {
    margin: 0;
    padding: 0;
  }
}
</style>
