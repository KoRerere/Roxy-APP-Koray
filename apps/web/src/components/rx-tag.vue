<script setup lang="ts">
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'

interface TagProps {
  icon?: SvgNames
  label?: string | number
  disabled?: boolean
  readonly?: boolean
  tooltip?: string
}

defineProps<TagProps>()
</script>

<template>
  <div v-tooltip.top="tooltip" class="flex items-center rx-tag" :class="{ 'icon-only': !label, 'disabled': disabled, 'readonly': readonly }">
    <RxSvgIcon v-if="icon" class="pointer-events-none" :name="(icon as SvgNames)" :size="14" />
    <div v-if="label" class="select-none pointer-events-none rx-tag-label">
      {{ label }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
.rx-tag {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-md, 6px);
  padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
  border-radius: 4px;
  border: 0.5px solid var(--component-tag-border, #e4e8eb);
  background: var(--component-tag-bg, #f0f3f5);

  color: var(--component-tag-text, #575d61);
  font-family: Inter;
  font-size: 12px;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);

  &:not(.disabled):not(.readonly):hover {
    .rx-tag-label {
      color: var(--component-tag-text-hover, #343a3d);
    }
  }

  &.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &.icon-only {
    aspect-ratio: 1;
  }
}
</style>
