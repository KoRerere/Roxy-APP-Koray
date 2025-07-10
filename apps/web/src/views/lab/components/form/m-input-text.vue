<script setup lang="ts">
import type { InputTextProps } from 'primevue/inputtext'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'

interface Props extends /* @vue-ignore */ Omit<InputTextProps, 'size'> {
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | (string & {})
  icon?: SvgNames
  preIcon?: SvgNames
  fluid?: boolean
  fieldProps?: Record<string, any>,
}

defineOptions({
  inheritAttrs: false,
})

const { size = 'sm', icon, preIcon, fieldProps, fluid = true, ...props } = defineProps<Props>()

defineEmits(['preIconClick', 'iconClick'])

const attrs = useAttrs()
const slots = useSlots()

</script>

<template>
  <IconField class="w-full" :class="size" v-bind="fieldProps">
    <InputIcon v-if="preIcon">
      <RxSvgIcon class="cursor-pointer" :name="preIcon" @click="$emit('preIconClick')" />
    </InputIcon>
    <InputText v-bind="{ ...attrs, ...props }" :fluid />
    <InputIcon v-if="icon || slots.icon">
      <slot name="icon">
        <RxSvgIcon class="cursor-pointer" :name="icon!" @click="$emit('iconClick')" />
      </slot>
    </InputIcon>
  </IconField>
</template>

<style lang="scss" scoped>
.lg {
  --input-padding: 10px;
  --input-left-padding: var(--spacing-xl, 12px);
  --input-gap: 8px;
  --input-border-width: 1px;
  --input-radius: var(--component-colors-textinput-radius-radius-lg, 8px);
  --input-font-size: 14px;
  --input-line-height: var(--line-height-text-lg, 20px);
}

.md {
  --input-padding: 8px;
  --input-left-padding: 10px;
  --input-gap: var(--spacing-md, 6px);
  --input-border-width: 1px;
  --input-radius: var(--component-colors-textinput-radius-radius-md, 6px);
  --input-font-size: 13px;
  --input-line-height: var(--line-height-text-lg, 20px);
}

.sm {
  --input-padding: var(--spacing-md, 6px);
  --input-left-padding: 8px;
  --input-gap: var(--spacing-md, 6px);
  --input-border-width: 1px;
  --input-radius: var(--component-colors-textinput-radius-radius-md, 6px);
  --input-font-size: 12px;
  --input-line-height: var(--line-height-text-lg, 20px);
}

.xs {
  --input-padding: var(--spacing-md, 6px);
  --input-left-padding: var(--spacing-md, 6px);
  --input-gap: var(--spacing-md, 6px);
  --input-border-width: 0.5px;
  --input-radius: var(--radius-sm, 4px);
  --input-font-size: 12px;
  --input-line-height: var(--line-height-text-xs, 16px);
}

.xxs {
  --input-padding: var(--spacing-sm, 4px);
  --input-left-padding: var(--spacing-md, 6px);
  --input-gap: var(--spacing-md, 6px);
  --input-border-width: 0.5px;
  --input-radius: var(--radius-sm, 4px);
  --input-font-size: 12px;
  --input-line-height: var(--line-height-text-xs, 16px);
}

// 统一的样式规则
.p-inputtext {
  font-family: Inter;
  padding: var(--input-padding);
  border-width: var(--input-border-width);
  border-radius: var(--input-radius);
  font-size: var(--input-font-size);
  line-height: var(--input-line-height);

  &:not(:first-child) {
    padding-left: calc(var(--input-left-padding) + var(--icon-size) + var(--input-gap));
  }

  &:not(:last-child) {
    padding-right: calc(var(--input-padding) + var(--icon-size) + var(--input-gap));
  }
}

// 图标位置
.p-inputicon {
  &:first-child {
    left: var(--input-left-padding);
  }

  &:last-child {
    right: var(--input-padding);
  }
}
</style>
