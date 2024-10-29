<script setup lang="ts">
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'

interface TagProps {
  icon?: SvgNames
  label?: string | number
  disabled?: boolean
}

defineProps<TagProps>()
</script>

<template>
  <div class="flex items-center cursor-default rx-tag" :class="{ 'icon-only': !label, 'disabled': disabled }">
    <RxSvgIcon v-if="icon" :name="(icon as SvgNames)" :size="14" />
    <div v-if="label" class="rx-tag-label">
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
  border: 0.5px solid var(--Component-Colors-Tag-border, #e4e8eb);
  background: var(--Component-Colors-Tag-bg, #f0f3f5);

  color: var(--Component-Colors-Tag-text, #575d61);
  font-family: Inter;
  font-size: 12px;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);

  &:not(.disabled):hover {
    .rx-tag-label {
      color: var(--Component-Colors-Tag-text-hover, #343a3d);
    }
  }

  &.icon-only {
    aspect-ratio: 1;
  }
}
</style>
