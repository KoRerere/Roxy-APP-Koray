<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import { RxSvgIcon } from '/@/components/rx-icon/'

import { getSortIcon } from '/@/utils'
import type { SortOrderNumber } from '/@/utils'

const sortColumns = defineModel<any[]>('columns', { default: [] })

const sortField = defineModel('sortField')
const sortOrder = defineModel('sortOrder')

const popoverRef = useTemplateRef('popover')

function toggle(event: Event) {
  popoverRef.value?.instance?.toggle(event)
}

const isBadge = computed(() => {
  if (sortField.value && sortColumns.value) {
    const col = sortColumns.value.find(item => item.key === sortField.value)
    if (col)
      return !col._visible
    // 老的排序字段不可能显示在table上，所以它永远要显示这个Badge
    return true
  }
  return false
})
</script>

<template>
  <slot name="before" />
  <div class="position-relative flex">
    <RxButton v-tooltip.top="$t('自定义排版')" severity="secondary" size="xxs" outlined icon="base/rx_ic_slider_v" @click="toggle" />
    <div v-if="isBadge" class="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 size-8px rounded-full bg-[var(--colors-background-bg-brand)]" />
  </div>
  <RyPopover ref="popover">
    <div :class="display.content">
      <VueDraggable v-model="sortColumns" :animation="150" handle=".handle">
        <div v-for="item in sortColumns" :key="item.key" class="flex items-center" :class="display.column">
          <RxSvgIcon name="base/rx_ic_dots_drag" class="cursor-grab handle" />
          <span class="flex-auto" :class="[sortField === item.key ? 'color-[var(--colors-text-text-brand)]' : '', display.label]">
            {{ item.title }}
            <RxSvgIcon v-if="sortField === item.key" :name="getSortIcon(sortOrder as SortOrderNumber)" size="12px" color="var(--colors-icon-icon-note)" />
          </span>
          <RxToggleSwitch v-if="!item.disabledToggle" v-model="item._visible" />
        </div>
      </VueDraggable>
    </div>
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </RyPopover>
</template>

<style lang="scss" module="display">
.content {
  padding: 6px 4px;
}

.label {
  font-weight: 500;
}

.column {
  padding: 8px 6px;
  gap: 4px;
  min-width: 260px;
  color: var(--colors-text-text-primary);
  font-family: Inter;
  font-size: 13px;
  line-height: var(--Line-Height-text-xs, 16px);
}

.changed {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #12a3fc;
}
</style>
