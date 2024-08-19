<script setup lang="ts">
import { CloseOutlined } from '@ant-design/icons-vue'

defineProps({
  selectedCount: {
    type: Number,
    default: 0,
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

defineEmits(['clearSelection'])
</script>

<template>
  <div class="selection-operation">
    <slot name="selection-operation">
      <div class="selection-operation-item">
        <span>{{ selectedCount }} of {{ total }} selected</span>
        <CloseOutlined @click="$emit('clearSelection')" />
      </div>
      <div v-for="item in operation" :key="item.name" class="selection-operation-item">
        {{ item.name }}
      </div>
    </slot>
  </div>
</template>

<style lang="scss" scoped>
.selection-operation {
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
  }
}
</style>
