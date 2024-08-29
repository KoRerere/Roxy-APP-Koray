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

defineEmits(['update:selection', 'batchOperation'])

const _operation = computed(() => props.operation.filter(item => item.name))
</script>

<template>
  <div class="multiple-operation">
    <div class="multiple-operation-item">
      <span><span class=" text-white">{{ selection.length }}</span> of <span class=" text-white">{{ total }}</span>
        selected</span>
      <span class="mdi mdi-close cursor-pointer" @click="$emit('update:selection', [])" />
    </div>
    <slot name="multiple-operation">
      <div v-for="item in _operation" :key="item.name" class="cursor-pointer multiple-operation-item"
        @click="$emit('batchOperation', item)">
        {{ item.name }}
      </div>
    </slot>
  </div>
</template>

<style lang="scss" scoped>
.multiple-operation {
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

  &-item {
    display: flex;
    align-items: center;
    padding: var(--spacing-md, 6px) 8px;
    gap: var(--spacing-md, 6px);
    border-radius: 5px;
    border: 0.5px solid var(--Color-neutrals-600, #575e61);
    background: var(--Color-neutrals-800, #252a2e);

    color: rgba(255, 255, 255, 0.6);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}
</style>
