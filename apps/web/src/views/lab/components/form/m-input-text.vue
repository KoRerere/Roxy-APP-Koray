<script setup lang="ts">
import type { InputTextProps } from 'primevue/inputtext'
import type { SvgNames } from '/@/components/rx-icon/'

interface Props extends /* @vue-ignore */ Omit<InputTextProps, 'size'> {
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | (string & {})
  icon?: SvgNames
  iconClass?: any
  preIcon?: SvgNames
  fluid?: boolean
  fieldProps?: Record<string, any>
}

defineOptions({
  inheritAttrs: false,
})

const { size = 'sm', icon, preIcon, fieldProps, fluid = true, ...props } = defineProps<Props>()

defineEmits(['preIconClick', 'iconClick'])

const attrs = useAttrs()
const slots = useSlots()

const inputRef = useTemplateRef<{ $el: HTMLInputElement }>('input')

defineExpose({
  focus: () => {
    inputRef.value?.$el.focus()
  },
  blur: () => {
    inputRef.value?.$el.blur()
  },
})
</script>

<template>
  <IconField class="w-full" :class="size" v-bind="fieldProps">
    <InputIcon v-if="preIcon || slots.preIcon">
      <slot name="preIcon">
        <SvgIcon class="cursor-pointer" :name="preIcon!" @click="$emit('preIconClick')" />
      </slot>
    </InputIcon>
    <InputText ref="input" v-bind="{ ...attrs, ...props }" :fluid />
    <InputIcon v-if="icon || slots.icon">
      <slot name="icon">
        <SvgIcon class="cursor-pointer" :class="iconClass" :name="icon!" @click="$emit('iconClick')" />
      </slot>
    </InputIcon>
  </IconField>
</template>

<style lang="scss" scoped>
.lg {
  --input-padding: 10px;
  --input-left-padding: 12px;
  --input-gap: 8px;
  --input-border-width: 1px;
  --input-radius: 8px;
  --input-font-size: 14px;
  --input-line-height: 20px;
}

.md {
  --input-padding: 8px;
  --input-left-padding: 10px;
  --input-gap: 6px;
  --input-border-width: 1px;
  --input-radius: 6px;
  --input-font-size: 13px;
  --input-line-height: 20px;
}

.sm {
  --input-padding: 6px;
  --input-left-padding: 8px;
  --input-gap: 6px;
  --input-border-width: 1px;
  --input-radius: 6px;
  --input-font-size: 12px;
  --input-line-height: 20px;
}

.xs {
  --input-padding: 6px;
  --input-left-padding: 6px;
  --input-gap: 6px;
  --input-border-width: 0.5px;
  --input-radius: 4px;
  --input-font-size: 12px;
  --input-line-height: 16px;
}

.xxs {
  --input-padding: 4px;
  --input-left-padding: 6px;
  --input-gap: 6px;
  --input-border-width: 0.5px;
  --input-radius: 4px;
  --input-font-size: 12px;
  --input-line-height: 16px;
}

.p-iconfield {
  svg {
    width: var(--icon-size);
    height: var(--icon-size);
  }
}

// 统一的样式规则
.p-iconfield .p-inputtext {
  font-family: Inter;
  padding: var(--input-padding);
  border-width: var(--input-border-width);
  border-radius: var(--input-radius);
  font-size: var(--input-font-size);
  line-height: var(--input-line-height);

  &:not(:first-child) {
    padding-left: calc(var(--input-left-padding) + var(--icon-size) + var(--input-gap));
    padding-inline-start: calc(var(--input-left-padding) + var(--icon-size) + var(--input-gap));
  }

  &:not(:last-child) {
    padding-right: calc(var(--input-padding) + var(--icon-size) + var(--input-gap));
    padding-inline-end: calc(var(--input-left-padding) + var(--icon-size) + var(--input-gap));
  }
}

// 图标位置
.p-iconfield .p-inputicon {
  &:first-child {
    left: var(--input-left-padding);
    inset-inline-start: var(--input-left-padding);
  }

  &:last-child {
    right: var(--input-padding);
    inset-inline-end: var(--input-padding);
  }
}
</style>
