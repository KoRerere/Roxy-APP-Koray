<script lang="ts" setup>
import type { RadioButtonProps } from 'primevue/radiobutton'

interface Props extends Omit<RadioButtonProps, 'size'> {
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg'
  options?: Array<{
    value: string | number | boolean
    label: string
    afterRender?: any
    disabled?: boolean
    [key: string]: any
  }>
}

defineOptions({
  inheritAttrs: false,
})

const { size = 'sm', options, ...props } = defineProps<Props>()
defineEmits(['change'])
const attrs = useAttrs()
</script>

<template>
  <div class="flex items-start flex-wrap gap-2 rx-radio-group" :class="attrs.class">
    <template v-for="{ label, value, afterRender, disabled, ...ops } in options" :key="label">
      <label :for="`${props.name}_${value}`" class="flex items-center cursor-pointer rx-radio-group-item" :class="[styles[size], { 'cursor-not-allowed': disabled }]">
        <RadioButton v-bind="{ ...$attrs, ...props, ...ops }" :input-id="`${props.name}_${value}`" :disabled="disabled" :value="value" @change="$emit('change')" />
        <div class="select-none rx-radio-group-item__text">{{ label }}</div>
      </label>
      <component :is="afterRender" v-if="afterRender" />
    </template>
  </div>
</template>

<style lang="scss" module="styles">
.xxs {
  padding: var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-md, 6px);
  gap: 6px;
  border-radius: var(--radius-sm, 4px);
  border-width: 0.5px;
  font-size: 12px;
  line-height: var(--Line-Height-text-xs, 16px);
}

.xs {
  padding: var(--spacing-md, 6px);
  gap: 6px;
  border-radius: var(--radius-sm, 4px);
  border-width: 0.5px;
  font-size: 12px;
  line-height: var(--Line-Height-text-xs, 16px);
}

.sm {
  padding: var(--spacing-md, 6px) var(--spacing-md, 6px) var(--spacing-md, 6px) 8px;
  gap: 6px;
  border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
  border-width: 1px;
  font-size: 12px;
  line-height: var(--Line-Height-text-lg, 20px);
}

.md {
  padding: 8px 8px 8px 10px;
  gap: 6px;
  border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
  border-width: 1px;
  font-size: 13px;
  line-height: var(--Line-Height-text-lg, 20px);
}

.lg {
  padding: 10px 10px 10px var(--spacing-xl, 12px);
  gap: 8px;
  border-radius: var(--Component-Colors-TextInput-radius-radius-lg, 8px);
  border-width: 1px;
  font-size: 14px;
  line-height: var(--Line-Height-text-lg, 20px);
}
</style>

<style lang="scss" scoped>
$size: 16px;

.rx-radio-group-item {
  min-width: 110px;
  border-style: solid;
  border-color: var(--colors-border-border-base, #AFB7BB);
  background: var(--colors-background-bg-action, #FFF);
  color: var(--colors-text-text-primary, #111213);
  box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
}

.rx-radio-group-item:has(.p-radiobutton-checked) {
  border-color: var(--colors-border-border-brand, #11A3FD);

  .rx-radio-group-item__text {
    color: var(--colors-text-text-brand, #11A3FD);
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
