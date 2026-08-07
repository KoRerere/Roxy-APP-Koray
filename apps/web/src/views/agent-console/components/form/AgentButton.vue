<script setup lang="ts">
import type { SvgNames } from '/@/components/rx-icon'

type ButtonVariant = 'accent' | 'brand' | 'danger' | 'primary' | 'secondary'

const props = withDefaults(defineProps<{
  disabled?: boolean
  icon?: SvgNames | false
  iconSize?: number | string
  label?: string
  loading?: boolean
  nativeType?: 'button' | 'reset' | 'submit'
  variant?: ButtonVariant
}>(), {
  icon: 'base/rx_ic_plus',
  iconSize: 18,
  label: 'button',
  nativeType: 'button',
  variant: 'accent',
})
</script>

<template>
  <button
    class="agent-button"
    :class="`agent-button--${props.variant}`"
    :type="props.nativeType"
    :disabled="props.disabled || props.loading"
    :aria-busy="props.loading || undefined"
  >
    <slot name="icon">
      <i v-if="props.loading" class="agent-button__icon i-svg-spinners:180-ring-with-bg" aria-hidden="true" />
      <SvgIcon v-else-if="props.icon" class="agent-button__icon" :name="props.icon" :size="props.iconSize" aria-hidden="true" />
    </slot>
    <span class="agent-button__label">
      <slot>{{ props.label }}</slot>
    </span>
  </button>
</template>

<style scoped lang="scss">
.agent-button {
  --agent-button-bg: var(--color-bg-primary-inverse);
  --agent-button-bg-hover: var(--color-bg-primary-inverse-hover);
  --agent-button-border: transparent;
  --agent-button-color: var(--color-text-primary-inverse);

  position: relative;
  display: inline-flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid var(--agent-button-border);
  border-radius: 10px;
  color: var(--agent-button-color);
  background: var(--agent-button-bg);
  box-shadow: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  outline: 0;
  text-align: center;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: var(--agent-button-bg-hover);
  }

  &:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--agent-button-color) 22%, transparent);
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
}

.agent-button__icon {
  flex: 0 0 auto;
}

.agent-button__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-button--primary {
  --agent-button-bg: var(--color-bg-primary-inverse);
  --agent-button-bg-hover: var(--color-bg-primary-inverse-hover);
  --agent-button-color: var(--color-text-primary-inverse);
}

.agent-button--secondary {
  --agent-button-bg: var(--color-bg-primary);
  --agent-button-bg-hover: var(--color-bg-secondary-hover);
  --agent-button-border: var(--color-border-secondary);
  --agent-button-color: var(--color-text-primary);
}

.agent-button--danger {
  --agent-button-bg: var(--color-bg-primary);
  --agent-button-bg-hover: var(--color-bg-secondary-hover);
  --agent-button-border: var(--color-border-error);
  --agent-button-color: var(--color-text-error-primary);
}

.agent-button--brand {
  --agent-button-bg: transparent;
  --agent-button-bg-hover: var(--color-bg-button-pink);
  --agent-button-border: #ee46bc;
  --agent-button-color: #ee46bc;
}

.agent-button--accent {
  --agent-button-bg: var(--agent-gradient, linear-gradient(127deg, #3faaf6 10.127%, #f359dc 44.937%, #f28fb0 100%));
  --agent-button-bg-hover:
    linear-gradient(90deg, rgb(0 0 0 / 10%) 0%, rgb(0 0 0 / 10%) 100%),
    var(--agent-gradient, linear-gradient(127deg, #3faaf6 10.127%, #f359dc 44.937%, #f28fb0 100%));
  --agent-button-color: var(--color-text-primary-inverse);
}
</style>
