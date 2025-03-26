<script setup lang="ts">
import currency from 'currency.js'

const { presets = [20, 50, 100, 300], disabled = false } = defineProps<{
  presets?: number[],
  disabled?: boolean,
}>()

const emit = defineEmits<{
  (e: 'select', value: number): void
}>()

function handleSelect(item: number) {
  if (disabled) return

  emit('select', item)
}

</script>

<template>
  <template v-for="item in presets" :key="item">
    <div class="py-1 px-3 rounded-full cursor-pointer select-none preset" :class="{ disabled }"
      @click="handleSelect(item)">
      {{ currency(item, { precision: 0 }).format() }}
    </div>
  </template>
</template>

<style scoped>
.preset {
  border: 0.5px solid var(--Component-Colors-Tag-border, #E4E8EB);
  background: var(--Component-Colors-Tag-bg, #F0F3F5);
  color: var(--Component-Colors-Tag-text, #575D61);
  font-family: Inter;
  font-size: 12px;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
