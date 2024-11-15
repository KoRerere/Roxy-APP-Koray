<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'
import { type Operation, operationPower } from '/@/utils'

const props = defineProps({
  operation: {
    type: Array as PropType<Operation[]>,
    default: () => [],
  },
  loadingOperationMap: {
    type: Object,
    default: () => ({}),
  },
  showMenu: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['quickClick', 'more'])

const _operation = computed(() => operationPower(props.operation))
const quickOperation: any = computed(() => _operation.value.filter((item: any) => item.quick))
const loadingQuickOperation: any = computed(() => props.loadingOperationMap)

function quickClick(item: any) {
  if (item.disabled || loadingQuickOperation.value?.[item.name]) {
    return
  }
  emit('quickClick', item)
}

function onMore(event: Event) {
  emit('more', { event, operation: toRaw(_operation.value) })
}
</script>

<template>
  <div class="flex items-center">
    <div class="quick">
      <div v-for="item in quickOperation" :key="item.name">
        <component :is="item.render" v-if="item.render" />
        <RxSvgIcon v-else v-tooltip.top="{ value: item.disabled ? item.disabledTooltip : item.tooltip, showDelay: 500, hideDelay: 300, pt: { root: '!max-w-sm' } }" class="quick-item"
          :name="loadingQuickOperation?.[item.name] ? 'base/rx_ic_progress_bar' : item.icon" :size="16"
          :class="[item.iconClass, { 'disabled text-gray-300': item.disabled }, { 'pi-spin disabled': loadingQuickOperation?.[item.name] }]" @click.stop="quickClick(item)" />
      </div>
      <div v-if="showMenu" class="cursor-pointer line-height-none" @click.stop="onMore">
        <slot name="more-icon">
          <RxSvgIcon name="base/rx_ic_more-v" />
        </slot>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.quick {
  display: flex;
  align-items: center;
  gap: var(--spacing-xl, 12px);

  &-item {
    font-size: 16px;
    line-height: 1;
    cursor: pointer;

    &:active {
      color: orange;
    }

    &.disabled {
      cursor: not-allowed;
    }
  }
}
</style>
