<script setup lang="ts">
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
    <div class="multiple-group">
      <span class="multiple-group-text"><span class=" text-white">{{ selection.length }}</span> of <span
          class=" text-white">{{ total }}</span>
        selected</span>
      <span class="mdi mdi-close cursor-pointer" @click="$emit('update:selection', [])" />
    </div>
    <slot name="custom-operation">
      <div v-for="(list, index) in groups" :key="index" class="multiple-group">
        <span v-for="item in list" :key="item.name"
          v-tooltip.top="{ value: item.disabled ? `某些选中项${item.disabledTips}` : '', showDelay: 500 }"
          class="multiple-group-icon" :class="[item.icon, { disabled: item.disabled }]" @click="batchOperation(item)" />
      </div>
    </slot>
  </div>
</template>

<style lang="scss" scoped>
.multiple {
  position: absolute;
  left: 50%;
  bottom: 20%;
  transform: translateX(-50%);
  z-index: 99;

  color: white;

  display: flex;
  padding: var(--spacing-sm, 4px);
  align-items: center;
  gap: var(--spacing-sm, 4px);
  border-radius: 8px;
  background: var(--Color-neutrals-950, #0e1214);
  box-shadow:
    0px 3px 8px 0px rgba(0, 0, 0, 0.07),
    0px 2px 5px 0px rgba(0, 0, 0, 0.07),
    0px 1px 1px 0px rgba(0, 0, 0, 0.07);

  &-group {
    display: flex;
    align-items: center;
    padding: var(--spacing-md, 6px) 8px;
    gap: var(--spacing-md, 6px);
    border-radius: 5px;
    border: 0.5px solid var(--Color-neutrals-600, #575e61);
    background: var(--Color-neutrals-800, #252a2e);
    font-size: 16px;
    line-height: 1;

    &-text {
      color: rgba(255, 255, 255, 0.6);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 400;
      line-height: var(--Line-Height-text-xs, 16px);
    }

    &-icon {
      font-size: 16px;
      gap: 8px;
      cursor: pointer;

      &.disabled {
        color: #cccccc;
        cursor: not-allowed;
      }
    }
  }
}
</style>
