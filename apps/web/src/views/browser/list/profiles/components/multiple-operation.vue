<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales'
import { type Operation, operationPower } from '/@/utils'

const props = defineProps({
  operation: {
    type: Array as PropType<Operation[]>,
    default: () => [],
  },
  selection: {
    type: Array,
    default: () => [],
  },
  clearSelection: {
    type: Function,
    default: () => () => { },
  },
})

const emits = defineEmits(['openBrowser', 'quickClick', 'more'])

const _operation = computed(() => operationPower(props.operation))
const multiplePperation = computed(() => _operation.value.filter((item: any) => item.multiple))

const quickGroup = computed<any[]>(() => Object.values(multiplePperation.value.reduce((groups, item) => {
  if (!item.name || !item.groupName || !item.multiple) {
    return groups
  }
  (groups[item.groupName] || (groups[item.groupName] = [])).push(item)
  return groups
}, {})))

function openBrowser() {
  emits('openBrowser', props.selection)
  props.clearSelection()
}
</script>

<template>
  <div class="cursor-pointer open" @click="openBrowser">
    <RxSvgIcon name="base/rx_ic_chrome" color="#12A3FC" />
    <span>{{ $t('打开') }}</span>
  </div>
  <div v-for="(group, index) in quickGroup" :key="index" class="group">
    <RxSvgIcon v-for="item in group" :key="item.name" v-tooltip.top="{ value: item.tooltip, showDelay: 500 }" :name="item.icon" class="cursor-pointer group-item" @click="$emit('quickClick', item)" />
    <RxSvgIcon v-if="index === quickGroup.length - 1" name="base/rx_ic_more-v" class="cursor-pointer group-item" @click.stop="$emit('more', { event: $event, operation: multiplePperation })" />
  </div>
</template>

<style lang="scss" scoped>
.open,
.group {
  display: flex;
  align-items: center;
  padding: var(--spacing-lg, 8px) var(--spacing-xl, 12px);
  border-radius: 5px;
  border: 0.5px solid var(--Color-neutrals-600, #575d61);
  background: var(--Color-neutrals-800, #252a2e);
}

.open {
  gap: var(--spacing-sm, 4px);
  color: #fff;
  font-family: Inter;
  font-size: 13px;
  font-weight: 600;
  line-height: var(--Line-Height-text-xs, 16px);
}

.group {
  gap: var(--spacing-xl, 12px);
  color: #ffffff;

  &-item:active {
    color: orange;
  }
}
</style>
