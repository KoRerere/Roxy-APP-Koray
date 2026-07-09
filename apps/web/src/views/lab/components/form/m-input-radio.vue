<script setup lang="ts">
import type { RadioButtonProps } from 'primevue/radiobutton'

interface Props extends /* @vue-ignore */ Omit<RadioButtonProps, 'size'> {
  name: string
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | (string & {})
  options?: {
    value: any
    label: string
    disabled?: boolean
    [key: string]: any
  }[]
}

defineOptions({ inheritAttrs: false })

const { name, size = 'sm', options, ...props } = defineProps<Props>()

const attrs = useAttrs()
</script>

<template>
  <div class="flex items-start flex-wrap gap-2" :class="size">
    <template v-for="{ label, value, disabled, ...ops } in options" :key="label">
      <label :for="`${name}_${value}`" class="flex items-center cursor-pointer min-w-25 radio" :class="{ 'cursor-not-allowed': disabled }">
        <RadioButton v-bind="{ ...attrs, ...props, ...ops }" :input-id="`${name}_${value}`" :name="name" :value="value" :disabled="disabled" />
        <div class="select-none text">{{ label }}</div>
      </label>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.xxs {
  --radio-padding: 4px 4px 4px 6px;
  --radio-gap: 6px;
  --radio-border-width: 0.5px;
  --radio-border-radius: 4px;
  --radio-font-size: 12px;
  --radio-line-height: 16px;
}

.xs {
  --radio-padding: 6px 6px 6px 6px;
  --radio-gap: 6px;
  --radio-border-width: 0.5px;
  --radio-border-radius: 4px;
  --radio-font-size: 12px;
  --radio-line-height: 16px;
}

.sm {
  --radio-padding: 6px 6px 6px 8px;
  --radio-gap: 6px;
  --radio-border-width: 1px;
  --radio-border-radius: 6px;
  --radio-font-size: 12px;
  --radio-line-height: 20px;
}

.md {
  --radio-padding: 8px 8px 8px 10px;
  --radio-gap: 6px;
  --radio-border-width: 1px;
  --radio-border-radius: 6px;
  --radio-font-size: 13px;
  --radio-line-height: 20px;
}

.lg {
  --radio-padding: 10px 10px 10px 12px;
  --radio-gap: 8px;
  --radio-border-width: 1px;
  --radio-border-radius: 8px;
  --radio-font-size: 14px;
  --radio-line-height: 20px;
}

.radio {
  padding: var(--radio-padding);
  gap: var(--radio-gap);
  border-width: var(--radio-border-width);
  border-style: solid;
  border-color: var(--colors-border-border-action);
  border-radius: var(--radio-border-radius);
  background: var(--colors-background-bg-action);
  box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);

  &:has(.p-radiobutton-checked) {
    border-color: var(--colors-border-border-brand);

    .text {
      color: var(--colors-text-text-brand);
      font-weight: 500;
    }
  }
}

.text {
  color: var(--colors-text-text-primary);
  font-size: var(--radio-font-size);
  line-height: var(--radio-line-height);
}
</style>
