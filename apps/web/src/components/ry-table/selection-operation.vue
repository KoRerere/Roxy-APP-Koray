<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'
import { deepClone } from '/@/utils'
import { motion } from 'motion-v'

const props = defineProps({
  selection: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
  total: {
    type: Number,
    default: 0,
  },
  operation: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
  batchOperation: {
    type: Function,
    default: () => () => { },
  },
})

const emit = defineEmits(['clearSelection', 'batchMore'])

const loadingMap = ref<Record<string, boolean>>({})
const multipleOptions = computed<Record<string, any>>(() => {
  const { menu, group, count } = props.operation.reduce((acc, item) => {
    if (!item.multiple)
      return acc
    const { items, ...rest } = toRaw(item)
    acc.menu.push({ ...rest, items: items?.filter((it: any) => it.multiple !== false) })

    if (rest.multipleProps) {
      acc.group[rest.multipleProps.name] ??= []
      acc.group[rest.multipleProps.name].push({ ...rest, ...rest.multipleProps, _rawItem: rest })
      acc.count += 1
    }

    return acc
  }, { menu: [], group: {}, count: 0 } as Record<string, any>)

  return {
    menu,
    showMore: menu.length > count,
    group: Object.entries(group).toSorted((a, b) => a[0].localeCompare(b[0])).map(([_, value]) => value),
  }
})

async function _batchOperation(event: MouseEvent, item: any) {
  if (item.disabled || loadingMap.value[item.name]) {
    return
  }

  loadingMap.value[item.name] = true
  await props.batchOperation({ ...deepClone(toRaw(item)), _event: event, _type: 'batch_quick' })
  loadingMap.value[item.name] = false
}

function onMore(event: Event) {
  emit('batchMore', { event, operation: multipleOptions.value.menu })
}
</script>

<template>
  <motion.div
    class="multiple"
    :initial="{ scale: 0.98, x: '-50%', opacity: 0 }"
    :animate="{ scale: 1, x: '-50%', opacity: 1 }"
    :exit="{ scale: 0.98, x: '-50%', opacity: 0 }"
    :transition="{ duration: 0.32, ease: [0, 0.71, 0.2, 1.01] }"
  >
    <div class="multiple-selected">
      <div>
        <i18n-t :keypath="$t('{selected} / {total} 已选中', { selected: '{selected}', total: '{total}' })" scope="global">
          <template #selected>
            <span class="text-white font-semibold">{{ selection.length }}</span>
          </template>
          <template #total>
            <span class="text-white font-semibold">{{ total }}</span>
          </template>
        </i18n-t>
      </div>
      <RxSvgIcon class="cursor-pointer" name="base/rx_ic_delete" color="#ffffff" @click="$emit('clearSelection')" />
    </div>
    <slot name="custom-operation">
      <div v-for="(list, index) in multipleOptions.group" :key="index" class="multiple-group">
        <div v-for="item in list" :key="item.name" v-tooltip.top="{ value: item.disabled ? item.disabledTooltip : '', showDelay: 500 }" :class="{ disabled: item.disabled }" class="multiple-group-item"
             @click="_batchOperation($event, item._rawItem)"
        >
          <RxSvgIcon class="pointer-events-none" :name="item.icon" v-bind="item.iconProps" />
          <span v-if="item.showLabel" class="icon-label">{{ item.label }}</span>
        </div>
      </div>
      <div v-if="multipleOptions.showMore" class="multiple-group cursor-pointer" @click.stop="onMore($event)">
        <RxSvgIcon name="base/rx_ic_more-v" class="pointer-events-none" />
      </div>
    </slot>
  </motion.div>
</template>

<style lang="scss" scoped>
.multiple {
  position: absolute;
  left: 50%;
  bottom: 15%;
  // transform: translateX(-50%);
  z-index: 99;
  min-height: 42px;

  display: inline-flex;
  padding: var(--spacing-sm, 4px);
  align-items: center;
  gap: var(--spacing-sm, 4px);
  border-radius: 8px;
  background: var(--pattern-actionbar-bg);
  box-shadow:
    0px 3px 8px 0px rgba(0, 0, 0, 0.07),
    0px 2px 5px 0px rgba(0, 0, 0, 0.07),
    0px 1px 1px 0px rgba(0, 0, 0, 0.07);

  // 优化动画过程中的字体渲染
  will-change: transform;
  backface-visibility: hidden;
  transform: translateZ(0);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  &-selected,
  &-group {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    border-radius: 5px;
    border: 0.5px solid var(--pattern-actionbar-btn-border);
    background: var(--pattern-actionbar-btn);
    white-space: nowrap;
  }

  &-selected {
    gap: var(--spacing-md, 6px);
    color: var(--pattern-actionbar-text-subtle);
    font-family: Inter;
    font-size: 13px;
    line-height: var(--Line-Height-text-xs, 16px);
  }

  &-group {
    gap: 12px;
    color: var(--pattern-actionbar-text);

    &:has(.icon-label) {
      padding: 0;

      .multiple-group-item {
        padding: 8px 12px;
      }
    }

    &-item {
      display: flex;
      align-items: center;
      gap: 4px;

      color: #fff;
      text-align: center;
      font-family: Inter;
      font-size: 13px;
      font-style: normal;
      font-weight: 600;
      line-height: 16px;
      cursor: pointer;
      user-select: none;
    }
  }
}

.disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
</style>
