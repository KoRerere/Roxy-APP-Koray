<script setup lang="ts">
import type { MessageEntry } from '../../types'
import { getStatusIconProps } from '../../hooks/useMessageItem'
import { getToolCallLabel } from '../../utils/tool-display'

const props = defineProps<{
  tool: MessageEntry
  tooltip?: string
}>()

const label = computed(() => getToolCallLabel(props.tool.meta))
</script>

<template>
  <div v-tooltip.top="tooltip ? { value: tooltip, showDelay: 500 } : undefined" class="flex items-center px-2 py-1.5 gap-2.5 rounded-1 tool">
    <SvgIcon name="base/rx_ic_browser_hammer" size="14" color="var(--colors-icon-icon-tertiary)" />
    <div class="flex-1 ellipsis-1 tool-name">
      {{ label }}
    </div>
    <SvgIcon v-bind="getStatusIconProps(tool.meta.status)" />
  </div>
</template>

<style lang="scss" scoped>
.tool {
  background: var(--pattern-resources-border-card-inactive);

  &-name {
    color: var(--colors-text-text-tertiary);
    font-size: 12px;
    font-weight: 500;
    line-height: 16px;
  }

  :deep(.tool-loading) {
    color: var(--colors-icon-icon-tertiary);
  }

  :deep(.tool-success) {
    color: var(--colors-icon-icon-success);
  }

  :deep(.tool-failed) {
    color: var(--colors-icon-icon-error);
  }
}
</style>
