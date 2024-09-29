<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'
import ryButton from './ry-button'

const props = defineProps({
  operation: {
    type: Array,
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

const quickOperation: any = computed(() => props.operation.filter((item: any) => item.quick))
const loadingQuickOperation: any = computed(() => props.loadingOperationMap)

function quickClick(item: any) {
  if (item.disabled || loadingQuickOperation.value?.[item.name]) {
    return
  }
  emit('quickClick', item)
}
</script>

<template>
  <div class="flex items-center">
    <div class="quick">
      <div v-for="item in quickOperation" :key="item.name">
        <component :is="item.component" v-if="item.component" />
        <RxSvgIcon v-else
          v-tooltip.top="{ value: item.disabled ? item.disabledTips : '', showDelay: 500, hideDelay: 300, pt: { root: '!max-w-sm' } }"
          class="quick-item" :name="loadingQuickOperation?.[item.name] ? 'base/rx_ic_progress_bar' : item.icon"
          :size="16"
          :class="[item.classes, { 'disabled text-gray-300': item.disabled }, { 'pi-spin disabled': loadingQuickOperation?.[item.name] }]"
          @click.stop="quickClick(item)" />
      </div>
    </div>
    <div v-if="showMenu" class="line-height-none" @click.stop="$emit('more', $event)">
      <slot name="more-icon">
        <ryButton text size="small" severity="secondary" icon="base/rx_ic_more-v" />
      </slot>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.quick {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg, 8px);

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
