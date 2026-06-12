<script setup lang="ts">
import type { SvgNames } from '/@/components/rx-icon'

interface Option {
  label?: string
  icon?: SvgNames
  value: any
  disabled?: boolean
  disabledTooltip?: string
  tooltip?: string
}

const props = defineProps<{
  disabled?: boolean
  disabledTooltip?: string
  options: Option[]
}>()

function getTooltip(item: Option) {
  if (props.disabled) {
    return props.disabledTooltip
  }
  if (item.disabled) {
    return item.disabledTooltip
  }
  return item.tooltip
}

const emit = defineEmits<{
  (e: 'change', item: Option): void
}>()

const model = defineModel<Option>()

function onChange(item: Option) {
  if (item.disabled || props.disabled) {
    return
  }
  model.value = item
  emit('change', item)
}
</script>

<template>
  <div class="flex overflow-hidden rounded-1.5 switch-group">
    <div v-for="item in options" :key="item.value" v-tooltip.top="{ value: getTooltip(item), showDelay: 500 }" class="
        flex-1 min-w-0 flex items-center justify-center cursor-pointer select-none transition-all duration-200 switch-group-item" :class="{
          active: model === item,
          disabled: item.disabled || disabled,
    }" @click="onChange(item)"
    >
      <slot name="item" :item="item">
        {{ item.label }}
      </slot>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.switch-group {
  border: 1px solid var(--colors-border-border-subtle);
  box-shadow: 0 1px 2px 0 rgba(16, 24, 40, 0.05);
}

.switch-group-item {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: 16px;
  border: 2px solid transparent;

  background: var(--colors-background-bg-action);

  &.active {
    color: var(--colors-text-text-brand);
    font-weight: 700;
    border-radius: 6px;
    border: 2px solid var(--colors-border-border-brand);
    background: var(--component-segment-bg-action);
    box-shadow: 0 1px 2px 0 rgba(16, 24, 40, 0.05);
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
