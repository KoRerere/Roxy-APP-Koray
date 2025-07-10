<script setup lang="ts">
import type { TextareaProps } from 'primevue/textarea'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'

type Size = 'xxs' | 'xs' | 'sm' | 'md' | 'lg'

interface Props extends /* @vue-ignore */ TextareaProps {
  size?: Size
  rows?: string | number
  cols?: string | number
  fluid?: boolean
  icon?: SvgNames
  preIcon?: SvgNames
  fieldProps?: Record<string, any>,
}

defineOptions({
  inheritAttrs: false,
})

const { size = 'sm', rows = 3, cols = 30, fluid = true, icon, preIcon, fieldProps, ...props } = defineProps<Props>()

defineEmits(['preIconClick', 'iconClick'])

const attrs = useAttrs()
</script>

<template>
  <IconField class="w-full" :class="size" v-bind="fieldProps">
    <InputIcon v-if="preIcon">
      <RxSvgIcon class="cursor-pointer" :name="preIcon" @click="$emit('preIconClick')" />
    </InputIcon>
    <Textarea v-bind="{ ...attrs, ...props }" :fluid="fluid" :rows="rows" :cols="cols" />
    <InputIcon v-if="icon">
      <RxSvgIcon class="cursor-pointer" :name="icon" @click="$emit('iconClick')" />
    </InputIcon>
  </IconField>
</template>

<style lang="scss" scoped>
:deep(.p-textarea) {
  resize: vertical;
  color: var(--colors-text-text-primary, #111213);
  font-family: Inter;
  border-color: var(--colors-border-border-base, #AFB7BB);

  &:disabled {
    color: var(--colors-text-text-placeholder, #7c8387);
  }
}

@mixin input-styles($pt, $pr, $pb, $pl, $gap, $borderWidth, $radius, $fontSize, $lineHeight) {
  .p-inputicon:first-child {
    left: $pl;
    top: calc(($lineHeight - $fontSize) / 2 + $pt);
    margin-top: 0;
  }

  .p-inputicon:last-child {
    right: $pr;
    top: calc(($lineHeight - $fontSize) / 2 + $pt);
    margin-top: 0;
  }

  .p-textarea {
    padding: $pt $pr $pb $pl;
    border-width: $borderWidth;
    border-radius: $radius;
    font-size: $fontSize;
    line-height: $lineHeight;

    &:not(:first-child) {
      padding-left: calc($pl + var(--icon-size) + $gap);
    }

    &:not(:last-child) {
      padding-right: calc($pr + var(--icon-size) + $gap);
    }
  }
}

.lg {
  @include input-styles(10px,
    10px,
    10px,
    var(--spacing-xl, 12px),
    8px,
    1px,
    var(--Component-Colors-TextInput-radius-radius-lg, 8px),
    14px,
    var(--Line-Height-text-lg, 20px));
}

.md {
  @include input-styles(8px,
    8px,
    8px,
    10px,
    var(--spacing-md, 6px),
    1px,
    var(--Component-Colors-TextInput-radius-radius-md, 6px),
    13px,
    var(--Line-Height-text-lg, 20px));
}

.sm {
  @include input-styles(var(--spacing-md, 6px),
    var(--spacing-md, 6px),
    var(--spacing-md, 6px),
    8px,
    var(--spacing-md, 6px),
    1px,
    var(--Component-Colors-TextInput-radius-radius-md, 6px),
    12px,
    var(--Line-Height-text-lg, 20px));
}

.xs {
  @include input-styles(var(--spacing-md, 6px),
    var(--spacing-md, 6px),
    var(--spacing-md, 6px),
    var(--spacing-md, 6px),
    var(--spacing-md, 6px),
    0.5px,
    var(--radius-sm, 4px),
    12px,
    var(--Line-Height-text-xs, 16px));
}

.xxs {
  @include input-styles(var(--spacing-sm, 4px),
    var(--spacing-sm, 4px),
    var(--spacing-sm, 4px),
    var(--spacing-md, 6px),
    var(--spacing-md, 6px),
    0.5px,
    var(--radius-sm, 4px),
    12px,
    var(--Line-Height-text-xs, 16px));
}
</style>
