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
  <div class="rx-radio">
    <label v-for="option in $props.options" :key="option.value" :for="`${$props.name}_${option.value}`"
      class="cursor-pointer rx-radio-item">
      <RadioButton v-bind="{ ...$attrs, ...$props }" :input-id="`${$props.name}_${option.value}`" :value="option.value"
        @change="$emit('change')" />
      <div>{{ option.label }}</div>
    </label>
  </div>
</template>

<style lang="scss" scoped>
.rx-radio {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-lg, 8px);

  &-item {
    display: flex;
    min-width: 120px;
    padding: 10px 10px 10px var(--spacing-xl, 12px);
    align-items: center;
    gap: var(--spacing-lg, 8px);
    border-radius: var(--Component-Colors-TextInput-radius-radius-lg, 8px);
    border: 1px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);
    background: var(--Component-Colors-TextInput-bg-bg, #ffffff);
    box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
  }
}
</style>
