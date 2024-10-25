<script setup lang="ts">
import type { ButtonProps } from 'primevue/button'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'

type Size = 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | undefined

interface Props extends /* @vue-ignore */ Omit<ButtonProps, 'size'> {
  size?: Size
  icon?: SvgNames
  iconSize?: number
  onClick?: (e: any) => Promise<void> | void
}

const { size = 'sm', iconSize = 16, ...props } = defineProps<Props>()

const outerLoading = defineModel('loading', { default: false })

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
</script>

<template>
  <Button v-bind="{ ...$attrs, ...props, onClick: handleClick }" :loading="_loading || outerLoading" :pt="{ root: ['rx_button', size] }">
    <template v-if="icon || $slots.icon" #icon>
      <slot name="icon">
        <RxSvgIcon :name="(icon as SvgNames)" :size="iconSize" />
      </slot>
    </template>
    <template #loadingicon>
      <slot name="loadingicon">
        <RxSvgIcon name="base/rx_ic_spin" class="loading-circle" />
      </slot>
    </template>
    <template v-if="$slots.default" #default>
      <RxSvgIcon v-if="_loading || outerLoading" class="loading-circle" name="base/rx_ic_spin" :size="iconSize" />
      <RxSvgIcon v-if="icon" :name="icon" :size="iconSize" />
      <slot />
    </template>
  </Button>
</template>

<style lang="scss" scoped>
:deep(svg) {
  pointer-events: none;
}

.lg {
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
  padding: var(--spacing-md, 6px) 10px;
  gap: var(--spacing-md, 6px);
  font-size: 12px;
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
  padding: var(--spacing-md, 6px) var(--spacing-lg, 8px);
  gap: var(--spacing-sm, 4px);
  font-size: var(--Font-Size-text-sm, 12px);
  line-height: var(--Line-Height-text-xs, 16px);
  border-radius: var(--radius-sm, 4px);
  border-width: 0.5px;

  &.p-button-icon-only {
    padding: var(--spacing-md, 6px);
    aspect-ratio: 1;

    svg {
      font-size: 16px;
    }
  }
}

.xxs {
  padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
  gap: var(--spacing-sm, 4px);
  font-size: var(--Font-Size-text-sm, 12px);
  line-height: var(--Line-Height-text-xs, 16px);
  border-radius: var(--radius-sm, 4px);
  border-width: 0.5px;

  &.p-button-icon-only {
    padding: var(--spacing-sm, 4px);
    aspect-ratio: 1;

    svg {
      font-size: 16px;
    }
  }
}

.p-button {
  font-family: Inter;
  font-weight: 500;
  color: var(--Component-Colors-Buttons-Primary-text, #fff);
  border-style: solid;
  border-color: var(--Component-Colors-Buttons-Primary-border, #0881cc);
  background: var(--Component-Colors-Buttons-Primary-bg, #12a3fc);
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);

  &.p-button-icon-only {
    width: auto;
    gap: 0;
  }

  svg {
    color: var(--Component-Colors-Buttons-Secondary-text, #e8f5fc);
  }

  &:not(:disabled):hover {
    color: var(--Component-Colors-Buttons-Primary-text, #fff);
    border-color: var(--Component-Colors-Buttons-Primary-border-hover, #015c94);
    background: var(--Component-Colors-Buttons-Primary-bg-hover, #0881cc);
    box-shadow:
      0px 4px 4px -1px rgba(0, 0, 0, 0.02),
      0px 1px 1px 0px rgba(0, 0, 0, 0.06);

    svg {
      color: var(--Component-Colors-Buttons-Secondary-text-hover, #ffffff);
    }
  }

  &:disabled {
    color: var(--Component-Colors-Buttons-Primary-text-inactive, #e8f5fc);
    border-color: var(--Component-Colors-Buttons-Primary-border-inactive, #12a3fc);
    background: var(--Component-Colors-Buttons-Primary-bg-inactive, #7eccfc);

    svg {
      color: var(--Component-Colors-Buttons-Secondary-text-inactive, #e8f5fc);
    }
  }
}

.p-button-text {
  border-color: transparent;
  box-shadow: none;

  &.p-button {
    &-secondary {
      color: var(--Component-Colors-Buttons-Secondary-text, #171c1f);
      background: var(--Component-Colors-Buttons-Secondary-bg, #fff);

      svg {
        color: var(--Component-Colors-Buttons-Secondary-text, #575d61);
      }

      &:not(:disabled):hover {
        color: var(--Component-Colors-Buttons-Secondary-text-hover, #0e1214);
        background: var(--Component-Colors-Buttons-Secondary-bg-inactive, #f0f3f5);

        svg {
          color: var(--Component-Colors-Buttons-Secondary-text-hover, #343a3d);
        }
      }

      &:disabled {
        color: var(--Component-Colors-Buttons-Secondary-text-inactive, #a3a9ad);
        background: var(--Component-Colors-Buttons-Secondary-bg-inactive, #f0f3f5);

        svg {
          color: var(--Component-Colors-Buttons-Secondary-text-inactive, #a3a9ad);
        }
      }
    }
  }
}

.p-button-outlined {
  background-color: transparent;
  border-color: var(--Component-Colors-Buttons-Tertiary-border, #12a3fc);
  color: var(--Component-Colors-Buttons-Ghost-text, #12a3fc);

  svg {
    color: var(--Colors-Icon-icon-brand, #12a3fc);
  }

  &:not(:disabled):hover {
    background-color: var(--Component-Colors-Buttons-Ghost-bg-hover, #e8f5fc);
    border-color: var(--Component-Colors-Buttons-Ghost-border-hover, #0881cc);
    color: var(--Component-Colors-Buttons-Ghost-text-hover, #0881cc);

    svg {
      color: var(--Colors-Icon-icon-brand-hover, #0881cc);
    }
  }

  &:disabled {
    background-color: transparent;
    color: var(--Component-Colors-Buttons-Ghost-text-inactive, #7eccfc);
    border-color: var(--Component-Colors-Buttons-Tertiary-bg-hover, #7eccfc);
    opacity: 1;

    svg {
      color: var(--Component-Colors-Buttons-Ghost-text-inactive, #7eccfc);
    }
  }

  &.p-button {
    &-secondary {
      color: var(--Component-Colors-Buttons-Secondary-text, #171c1f);
      border-color: var(--Component-Colors-Buttons-Secondary-border, #c7cdd1);
      background: var(--Component-Colors-Buttons-Secondary-bg, #fff);

      svg {
        color: var(--Component-Colors-Buttons-Secondary-text, #575d61);
      }

      &:not(:disabled):hover {
        color: var(--Component-Colors-Buttons-Secondary-text-hover, #0e1214);
        border-color: var(--Component-Colors-Buttons-Secondary-border-hover, #a3a9ad);
        background: var(--Component-Colors-Buttons-Secondary-bg-hover, #f0f3f5);

        svg {
          color: var(--Component-Colors-Buttons-Secondary-text-hover, #343a3d);
        }
      }

      &:disabled {
        color: var(--Component-Colors-Buttons-Secondary-text-inactive, #a3a9ad);
        border-color: var(--Component-Colors-Buttons-Secondary-border, #c7cdd1);
        background: var(--Component-Colors-Buttons-Secondary-bg-inactive, #f0f3f5);

        svg {
          color: var(--Component-Colors-Buttons-Secondary-text-inactive, #a3a9ad);
        }
      }
    }
  }
}
</style>
