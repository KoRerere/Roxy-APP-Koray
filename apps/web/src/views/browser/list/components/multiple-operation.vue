<script setup lang="ts">
import actions from '/@/components/actions.vue'

const props = defineProps({
  operation: {
    type: Array,
    default: () => [],
  },
  selection: {
    type: Array,
    default: () => [],
  },
})

defineEmits(['more'])

const multiplePperation = computed(() => props.operation.filter(item => !item.extraProps))

const groupName = [
  ['restart', 'close'],
  ['addGroup', 'addTag'],
]

const quickGroup = computed(() => groupName.map(group =>
  group.map(name =>
    multiplePperation.value.find(item =>
      item.name === name),
  ),
))
</script>

<template>
  <div v-for="(group, index) in quickGroup" :key="index" class="group">
    <span v-for="item in group" :key="item.name" :class="item.icon" class="group-item" />

    <actions v-if="index === quickGroup.length - 1" :operation="multiplePperation"
      @more="(data) => $emit('more', data)">
      <template #more-icon>
        <span class="mdi mdi-dots-vertical group-item" />
      </template>
    </actions>
  </div>
</template>

<style lang="scss" scoped>
.group {
  display: flex;
  padding: var(--spacing-md, 6px) 8px;
  align-items: flex-start;
  gap: 8px;
  border-radius: 5px;
  border: 0.5px solid var(--Color-neutrals-600, #575d61);
  background: var(--Color-neutrals-800, #252a2e);

  &-item {
    width: 16px;
    height: 16px;
    line-height: 1;
    font-size: 16px;
    cursor: pointer;

    &:active {
      color: orange;
    }
  }
}
</style>
