<script setup lang="ts">
import type { ButtonProps } from 'primevue/button'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'

type Size = 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | undefined

interface Props extends /* @vue-ignore */ Omit<ButtonProps, 'size'> {
  size?: Size
  icon?: SvgNames
  rotate?: boolean
  disabled?: boolean
  onClick?: (e: any) => Promise<any> | any
}

defineOptions({
  inheritAttrs: false,
})

const { size = 'sm', disabled = false, ...props } = defineProps<Props>()

const outerLoading = defineModel('loading', { default: false })

const btnElRef = useTemplateRef('btnEl')
const _loading = ref(false)

async function handleClick(e: MouseEvent) {
  if (props.onClick) {
    _loading.value = true
    try {
      await props.onClick(e)
    }
    finally {
      _loading.value = false
    }
  }
}

defineExpose({
  get btnEl() {
    return (btnElRef.value as any)?.$el
  },
})
</script>

<template>
  <Button ref="btnEl" v-bind="{ ...$attrs, ...props, onClick: handleClick }" :disabled="disabled || _loading || outerLoading" :loading="_loading || outerLoading" :class="['rx_button', size]">
    <template v-if="icon || $slots.icon" #icon>
      <slot name="icon">
        <RxSvgIcon :name="(icon as SvgNames)" :class="{ 'animate-spin': rotate }" class="animate-duration-2500" />
      </slot>
    </template>
    <template #loadingicon>
      <slot name="loadingicon">
        <RxSvgIcon name="base/rx_ic_spin" class="loading-circle" />
      </slot>
    </template>
    <template v-if="$slots.default" #default>
      <RxSvgIcon v-if="_loading || outerLoading" class="loading-circle" name="base/rx_ic_spin" />
      <RxSvgIcon v-if="icon" :name="icon" />
      <slot />
    </template>
  </Button>
</template>

<style lang="scss" scoped>
:deep(svg) {
  pointer-events: none;
}

.lg {
  min-width: 88px;
  padding: 10px var(--spacing-2xl, 16px);
  gap: var(--spacing-lg, 8px);
  font-size: var(--Font-Size-text-lg, 14px);
  line-height: var(--Line-Height-text-lg, 20px);
  border-radius: var(--radius-lg, 8px);
  border-width: 1px;

  &.p-button-icon-only {
    padding: var(--spacing-lg, 8px);
    aspect-ratio: 1;

    svg {
      font-size: 24px;
    }
  }
}

.md {
  min-width: 80px;
  padding: var(--spacing-lg, 8px) var(--spacing-xl, 12px);
  gap: var(--spacing-lg, 8px);
  font-size: 13px;
  line-height: var(--Line-Height-text-lg, 20px);
  border-radius: var(--radius-md, 6px);
  border-width: 1px;

  &.p-button-icon-only {
    padding: var(--spacing-lg, 8px);
    aspect-ratio: 1;

    svg {
      font-size: 20px;
    }
  }
}

.sm {
  min-width: 72px;
  padding: var(--spacing-md, 6px) 10px;
  gap: var(--spacing-md, 6px);
  font-size: var(--Font-Size-text-sm, 12px);
  line-height: var(--Line-Height-text-lg, 20px);
  border-radius: var(--radius-md, 6px);
  border-width: 1px;

  &.p-button-icon-only {
    padding: var(--spacing-lg, 8px);
    aspect-ratio: 1;

    svg {
      font-size: 16px;
    }
  }
}

.xs {
  min-width: 64px;
  padding: var(--spacing-md, 6px) var(--spacing-lg, 8px);
  gap: var(--spacing-sm, 4px);
  font-size: var(--Font-Size-text-sm, 12px);
  line-height: var(--Line-Height-text-xs, 16px);
  border-radius: var(--radius-sm, 4px);
  border-width: 0.5px;

  &:not(:disabled):hover {
    border-width: 0.5px;
  }

  &.p-button-icon-only {
    padding: var(--spacing-md, 6px);
    aspect-ratio: 1;

    svg {
      font-size: 16px;
    }
  }
}

.xxs {
  min-width: 56px;
  padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
  gap: var(--spacing-sm, 4px);
  font-size: var(--Font-Size-text-sm, 12px);
  line-height: var(--Line-Height-text-xs, 16px);
  border-radius: var(--radius-sm, 4px);
  border-width: 0.5px;

  &:not(:disabled):hover {
    border-width: 0.5px;
  }

  &.p-button-icon-only {
    padding: var(--spacing-sm, 4px);
    aspect-ratio: 1;

    svg {
      font-size: 16px;
    }
  }
}

.p-button.p-button-icon-only {
  min-width: auto;
  width: auto;
  gap: 0;
}

.p-button {
  font-weight: 500;
  box-shadow: 0px 4px 4px -1px rgba(0, 0, 0, 0.02), 0px 1px 1px 0px rgba(0, 0, 0, 0.06);

  svg {
    transition: color var(--button-transition-duration);
  }

  &:disabled {
    background: var(--component-button-primary-bg-inactive);
    border-color: var(--component-button-primary-border-inactive);
    color: var(--component-button-primary-text-inactive);
    opacity: 1;
  }

  &-secondary {
    &:disabled {
      background: var(--component-button-pale-bg-inactive);
    }
  }

  &-danger {
    &:disabled {
      background: var(--component-button-error-bg-inactive);
      border-color: var(--component-button-error-border-inactive);
      color: var(--component-button-error-text-inactive);
    }
  }
}

.p-button-outlined {
  background: var(--component-button-ghost-bg);

  &:not(:disabled):hover {
    border-color: var(--component-button-ghost-border-hover);
    color: var(--component-button-ghost-text-hover);
  }

  &:disabled {
    background: var(--component-button-ghost-bg-inactive);
    border-color: var(--component-button-ghost-border-inactive);
    color: var(--component-button-ghost-text-inactive);
  }

  &.p-button-secondary {
    background: var(--colors-background-bg-action, #FFF);

    svg {
      color: var(--colors-icon-icon-secondary);
    }

    &:not(:disabled):hover {
      border-color: var(--colors-border-border-action-hover);
      color: var(--colors-text-text-primary-hover);

      svg {
        color: var(--colors-icon-icon-secondary-hover);
      }
    }

    &:disabled {
      background: var(--colors-background-bg-action-inactive);
      border-color: var(--colors-border-border-subtle);
      color: var(--colors-text-text-inactive);

      svg {
        color: var(--colors-icon-icon-inactive);
      }
    }
  }
}

.p-button-text {
  box-shadow: none;

  &:disabled {
    border-color: transparent;
  }

  &.p-button-secondary {
    svg {
      color: var(--colors-icon-icon-secondary);
    }

    &:disabled {
      color: var(--colors-text-text-inactive);
      background: transparent;

      svg {
        color: var(--colors-icon-icon-inactive);
      }
    }
  }
}
</style>
