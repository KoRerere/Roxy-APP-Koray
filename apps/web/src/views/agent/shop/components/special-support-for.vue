<script setup lang="ts">
defineProps<{
  icons: string[]
}>()
</script>

<template>
  <div class="flex items-center gap-2.5">
    <div class="feature-label">
      {{ $t('特别支持') }}:
    </div>
    <div class="flex items-center gap-2.5">
      <div v-for="imgUrl in icons" :key="imgUrl" class="feature-icon">
        <img class="block w-3.5 h-3.5" :src="imgUrl">
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.feature-label {
  color: var(--colors-text-text-secondary, #cdcfd0);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
}

.feature-icon {
  display: flex;
  width: 20px;
  height: 20px;
  padding: 3px;
  justify-content: center;
  align-items: center;
  border-radius: 4px;
  border: 1px solid var(--colors-border-border-subtle, #48555b);
}
</style>
