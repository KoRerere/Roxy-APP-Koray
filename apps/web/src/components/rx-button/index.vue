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
  <Button v-bind="{ ...$attrs, ...props, onClick: handleClick }" :loading="loading" :pt="{ root: ['rx_button', size] }">
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

.rx_button {
  font-family: Inter;
  font-weight: 500;
}

.lg {
  padding: 10px var(--spacing-2xl, 16px);
  gap: var(--spacing-lg, 8px);
  font-size: var(--Font-Size-text-lg, 14px);
  line-height: var(--Line-Height-text-lg, 20px);
}

.md {
  padding: var(--spacing-lg, 8px) var(--spacing-xl, 12px);
  gap: var(--spacing-lg, 8px);
  font-size: 13px;
  line-height: var(--Line-Height-text-lg, 20px);
}

.sm {
  padding: var(--spacing-md, 6px) 10px;
  gap: var(--spacing-md, 6px);
  font-size: 12px;
  line-height: var(--Line-Height-text-lg, 20px);
}

.xs {
  padding: var(--spacing-md, 6px) var(--spacing-lg, 8px);
  gap: var(--spacing-sm, 4px);
  font-size: var(--Font-Size-text-sm, 12px);
  line-height: var(--Line-Height-text-xs, 16px);
}

.xxs {
  padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
  gap: var(--spacing-sm, 4px);
  font-size: var(--Font-Size-text-sm, 12px);
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
