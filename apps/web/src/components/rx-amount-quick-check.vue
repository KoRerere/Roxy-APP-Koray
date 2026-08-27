<script setup lang="ts">
import currency from 'currency.js'

const { presets = [50, 100, 500, 1000], disabled = false, min = 0 } = defineProps<{
  presets?: number[]
  disabled?: boolean
  /** 低于该金额的快捷选项禁用 */
  min?: number
}>()

const emit = defineEmits<{
  (e: 'select', value: number): void
}>()

const actualPresets = computed(() => {
  return presets.map((value) => {
    return {
      text: currency(value, { precision: 0 }).format(),
      value,
      disabled: disabled || value < min,
    }
  })
})

function handleSelect(value: number, itemDisabled: boolean) {
  if (itemDisabled)
    return

  emit('select', value)
}
</script>

<template>
  <div class="flex items-center gap-2">
    <div v-for="item in actualPresets" :key="item.value" class="relative min-w-25 py-1.5 px-4 text-center rounded-1.5 cursor-pointer select-none preset" :class="{ disabled: item.disabled }"
         @click="handleSelect(item.value, item.disabled)"
    >
      <span class="preset-text">{{ item.text }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.preset {
  border: 0.5px solid var(--component-tag-border);
  background: var(--component-tag-bg);

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &-text {
    color: var(--component-tag-text);
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
  }
}
</style>
