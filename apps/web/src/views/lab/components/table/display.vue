<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import { RxSvgIcon } from '/@/components/rx-icon/'
import type { SortOrderNumber } from '/@/utils'
import { getSortIcon } from '/@/utils'

const { sortField = '', sortOrder = 0 } = defineProps<{
  /** 当前服务端排序列 field，与 lab table `tableSort` 联动 */
  sortField?: string
  sortOrder?: SortOrderNumber
}>()

const columns = defineModel<any[]>({ default: [] })

const popRef = useTemplateRef('popover')

function toggle(event: Event) {
  popRef.value?.instance?.toggle(event)
}

/** 当前排序列被隐藏或已不在列配置中时，在按钮角标提示仍有排序生效 */
const showSortBadge = computed(() => {
  if (!sortField || !columns.value?.length)
    return false
  const col = columns.value.find((item: any) => item.field === sortField)
  if (col)
    return col._visible === false
  return true
})
</script>

<template>
  <div class="flex">
    <div class="relative inline-flex">
      <RxButton severity="secondary" size="xxs" outlined icon="base/rx_ic_slider_v" :label="$t('自定义排版')" @click="toggle" />
      <div
        v-if="showSortBadge"
        class="pointer-events-none absolute top-0 right-0 size-8px translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--colors-background-bg-brand)]"
      />
    </div>
    <RyPopover ref="popover">
      <div class="py-1.5 px-1">
        <VueDraggable v-model="columns" :animation="150" handle=".handle">
          <div v-for="item in columns" :key="item.field" class="flex items-center" :class="display.item">
            <RxSvgIcon name="base/rx_ic_dots_drag" class="handle cursor-grab" />
            <span
              class="flex-auto font-500" :class="[
                sortField === item.field ? 'text-[var(--colors-text-text-brand)]' : '',
              ]"
            >
              {{ item.header }}
              <RxSvgIcon
                v-if="sortField === item.field"
                :name="getSortIcon((sortOrder ?? 0) as SortOrderNumber)"
                size="12px"
                color="var(--colors-icon-icon-note)"
              />
            </span>
            <RxToggleSwitch v-if="!item.disabledToggle" v-model="item._visible" />
          </div>
        </VueDraggable>
      </div>
      <template v-if="$slots.footer" #footer>
        <slot name="footer" />
      </template>
    </RyPopover>
  </div>
</template>

<style lang="scss" module="display">
.item {
  padding: var(--spacing-lg, 8px) var(--spacing-md, 6px);
  gap: var(--spacing-sm, 4px);
  min-width: 260px;
  color: var(--primitives-neutrals-900, #171c1f);
  font-family: Inter;
  font-size: 13px;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
