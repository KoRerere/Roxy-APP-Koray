<script setup lang="ts">
import type { InputTextProps } from 'primevue/inputtext'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'

type Size = 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | undefined

interface Props extends /* @vue-ignore */ Omit<InputTextProps, 'size'> {
  size?: Size
  leftIcon?: SvgNames | undefined
  icon?: SvgNames | undefined
}

defineOptions({
  inheritAttrs: false,
})

const { size = 'sm', leftIcon, icon, ...props } = defineProps<Props>()

defineEmits(['iconClick', 'change'])
</script>

<template>
  <IconField class="w-full" :pt="{ root: size }">
    <InputIcon v-if="leftIcon">
      <RxSvgIcon :name="(leftIcon as SvgNames)" class="cursor-pointer" @click="$emit('iconClick')" />
    </InputIcon>
    <InputText v-bind="{ ...$attrs, ...props }" fluid @input="$emit('change')" />
    <InputIcon v-if="icon">
      <RxSvgIcon :name="(icon as SvgNames)" class="cursor-pointer" @click="$emit('iconClick')" />
    </InputIcon>
  </IconField>
</template>

<style lang="scss" scoped>
@mixin input-styles($pt, $pr, $pb, $pl, $gap, $borderWidth, $radius, $fontSize, $lineHeight) {
  .p-inputicon:first-child {
    left: $pl;
  }

  .p-inputicon:last-child {
    right: $pr;
  }

  .p-inputtext {
    padding: $pt $pr $pb $pl;
    border-width: $borderWidth;
    border-radius: $radius;
    color: var(--Component-Colors-TextInput-text-text, #171c1f);
    font-family: Inter;
    font-size: $fontSize;
    line-height: $lineHeight;

    &:not(:first-child) {
      padding-left: calc($pl + var(--p-icon-size) + $gap);
    }

    &:not(:last-child) {
      padding-right: calc($pr + var(--p-icon-size) + $gap);
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
