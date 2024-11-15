<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'

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
})

const emit = defineEmits(['update:selection', 'batchOperation'])

const groups: any = computed(() => Object.values(props.operation.reduce((groups, item) => {
  if (!item.name || !item.multiple) {
    return groups
  }
  const groupName = item.groupName || 'Other';
  (groups[groupName] || (groups[groupName] = [])).push(item)
  return groups
}, {})))

function batchOperation(item: any) {
  if (item.disabled) {
    return
  }

  emit('batchOperation', item)
}
</script>

<template>
  <div class="multiple">
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
      <RxSvgIcon class="cursor-pointer" name="base/rx_ic_delete" @click="$emit('update:selection', [])" />
    </div>
    <slot name="custom-operation">
      <div v-for="(list, index) in groups" :key="index" class="multiple-group">
        <RxSvgIcon v-for="item in list" :key="item.name" v-tooltip.top="{ value: item.disabled ? `某些选中项${item.disabledTooltip}` : '', showDelay: 500 }" :class="{ disabled: item.disabled }"
          :name="item.icon" class="cursor-pointer" color="#ffffff" @click="batchOperation(item)" />
      </div>
    </slot>
  </div>
</template>

<style lang="scss" scoped>
.multiple {
  position: absolute;
  left: 50%;
  bottom: 15%;
  transform: translateX(-50%);
  z-index: 99;

  display: inline-flex;
  padding: var(--spacing-sm, 4px);
  align-items: center;
  gap: var(--spacing-sm, 4px);
  border-radius: 8px;
  background: var(--Color-neutrals-950, #0e1214);
  box-shadow:
    0px 3px 8px 0px rgba(0, 0, 0, 0.07),
    0px 2px 5px 0px rgba(0, 0, 0, 0.07),
    0px 1px 1px 0px rgba(0, 0, 0, 0.07);

  &-selected,
  &-group {
    display: flex;
    align-items: center;
    padding: var(--spacing-lg, 8px) var(--spacing-xl, 12px);
    border-radius: 5px;
    border: 0.5px solid var(--Color-neutrals-600, #575d61);
    background: var(--Color-neutrals-800, #252a2e);
  }

  &-selected {
    gap: var(--spacing-md, 6px);
    color: rgba(255, 255, 255, 0.6);
    font-family: Inter;
    font-size: 13px;
    line-height: var(--Line-Height-text-xs, 16px);
  }

  &-group {
    gap: var(--spacing-xl, 12px);
    color: #ffffff;
  }
}
</style>
