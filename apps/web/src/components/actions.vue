<script setup lang="ts">
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

const emit = defineEmits(['iconClick', 'more'])

const quickOperation: any = computed(() => props.operation.filter((item: any) => item.quick))
const loadingQuickOperation: any = computed(() => props.loadingOperationMap)

function iconClick(item: any) {
  if (item.disabled || loadingQuickOperation.value?.[item.name]) {
    return
  }
  emit('iconClick', item)
}
</script>

<template>
  <div class="flex items-center">
    <div class="quick">
      <span v-for="item in quickOperation" :key="item.name"
        v-tooltip.top="{ value: item.disabled ? item.disabledTips : '', showDelay: 500 }" class="quick-item"
        :class="[loadingQuickOperation?.[item.name] ? 'pi-spin mdi mdi-selection-ellipse' : item.icon, { disabled: item.disabled }]"
        @click.stop="iconClick(item)" />
    </div>
    <div v-if="showMenu" class="line-height-none" @click.stop="$emit('more', $event)">
      <slot name="more-icon">
        <ryButton text size="small" icon="mdi mdi-dots-vertical" />
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
      color: #cccccc;
      cursor: not-allowed;
    }
  }
}
</style>
