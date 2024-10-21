<script lang="ts" setup>
import type { RadioButtonProps } from 'primevue/radiobutton'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | undefined

interface Props extends RadioButtonProps {
  size?: Size
  options: Array<{ value: string | number, label: string }>
}

defineOptions({
  inheritAttrs: false,
})

defineProps<Props>()

defineEmits(['change'])
</script>

<template>
  <div class="radio-group">
    <label v-for="option in $props.options" :key="option.value" :for="`${$props.name}_${option.value}`"
      class="cursor-pointer radio-group-item">
      <RadioButton v-bind="{ ...$attrs, ...$props }" :input-id="`${$props.name}_${option.value}`" :value="option.value"
        @change="$emit('change')" />
      <div class="select-none radio-group-item__text">{{ option.label }}</div>
    </label>
  </div>
</template>

<style lang="scss" scoped>
$size: 16px;

.radio-group {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-lg, 8px);

  &-item {
    display: flex;
    align-items: center;
    padding: var(--spacing-md, 6px) var(--spacing-md, 6px) var(--spacing-md, 6px) 8px;
    gap: var(--spacing-md, 6px);
    min-width: 110px;
    border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
    border: 1px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);
    background: var(--Component-Colors-TextInput-bg-bg, #fff);
    box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);

    &__text {
      color: var(--Component-Colors-TextInput-text-text, #171c1f);
      font-family: Inter;
      font-size: 12px;
      line-height: var(--Line-Height-text-lg, 20px);
    }
  }
}

.radio-group-item:has(.p-radiobutton-checked) {
  border-color: var(--p-primary-color, #12a3fc);

  .radio-group-item__text {
    color: var(--p-primary-color, #12a3fc);
  }
}

:deep(.p-radiobutton) {
  width: $size;
  height: $size;

  .p-radiobutton-box {
    width: $size;
    height: $size;
  }

  .p-radiobutton-icon {
    width: calc($size * 0.5);
    height: calc($size * 0.5);
  }
}
</style>
