<script setup lang="ts">
import type { ButtonProps } from 'primevue/button'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'

type Size = 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | undefined

interface Props extends /* @vue-ignore */ Omit<ButtonProps, 'size'> {
  size?: Size
  icon?: SvgNames
  onClick?: (e: any) => Promise<void> | void
}

const { size = 'sm', ...props } = defineProps<Props>()

const loading = defineModel('loading', { default: false })

async function handleClick(e: MouseEvent) {
  if (props.onClick) {
    loading.value = true
    try {
      await props.onClick(e)
    }
    finally {
      loading.value = false
    }
  }
}
</script>

<template>
  <Button v-bind="{ ...$attrs, ...props, onClick: handleClick }" :loading="loading">
    <template v-if="icon || $slots.icon" #icon>
      <slot name="icon">
        <RxSvgIcon :name="(icon as SvgNames)" />
      </slot>
    </template>
    <template #loadingicon>
      <slot name="loadingicon">
        <RxSvgIcon name="base/rx_ic_spin" class="loading-circle" />
      </slot>
    </template>
    <template v-if="$slots.default" #default>
      <RxSvgIcon v-if="loading" class="loading-circle" name="base/rx_ic_spin" />
      <RxSvgIcon v-if="icon" :name="icon" />
      <slot />
    </template>
  </Button>
</template>

<style lang="scss" scoped>
:deep(svg) {
  pointer-events: none;
}
</style>
