<script setup lang="ts">
import type { RadioButtonProps } from 'primevue/radiobutton'

interface Props extends Omit<RadioButtonProps, 'size'> {
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | (string & {})
  options?: {
    value: any
    label: string
    disabled?: boolean
    [key: string]: any
  }[]
}

defineOptions({ inheritAttrs: false })

const { size = 'sm', ...props } = defineProps<Props>()

const attrs = useAttrs()
</script>

<template>
  <div class="flex items-start flex-wrap gap-2">
    <template v-for="{ label, value, disabled, ...ops } in options" :key="label">
      <label :for="`${label}_${value}`" class="flex items-center cursor-pointer" :class="{ 'cursor-not-allowed': disabled }">
        <RadioButton v-bind="{ ...attrs, ...props, ...ops }" :input-id="`${label}_${value}`" :value="value" :disabled="disabled" />
        <div class="select-none">{{ label }}</div>
      </label>
    </template>
  </div>
</template>

<style scoped></style>
