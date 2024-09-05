<script setup lang="ts">
import actions from '/@/components/actions.vue'

const props = defineProps({
  operation: {
    type: Array as PropType<any[]>,
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

const multiplePperation = computed(() => props.operation.filter((item: any) => item.multiple))

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
    <span class="mdi mdi-google-chrome open-icon" />
    <span class="open-text">Open</span>
  </div>
  <div v-for="(group, index) in quickGroup" :key="index" class="group">
    <span v-for="item in group" :key="item.name" :class="item.icon" class="cursor-pointer group-item" @click="$emit('quickClick', item)" />

    <actions v-if="index === quickGroup.length - 1" @more="(event: Event) => $emit('more', [event, multiplePperation])">
      <template #more-icon>
        <span class="mdi mdi-dots-vertical group-item" />
      </template>
    </actions>
  </div>
</template>

<style lang="scss" scoped>
.group,
.open {
  display: flex;
  padding: var(--spacing-md, 6px) 8px;
  align-items: flex-start;
  gap: 8px;
  border-radius: 5px;
  border: 0.5px solid var(--Color-neutrals-600, #575d61);
  background: var(--Color-neutrals-800, #252a2e);
  line-height: 1;

  &-item {
    width: 16px;
    height: 16px;
    font-size: 16px;
    cursor: pointer;

    &:active {
      color: orange;
    }
  }
}

.open {
  gap: var(--spacing-sm, 4px);

  &-icon {
    width: 16px;
    height: 16px;
    font-size: 16px;
  }

  &-text {
    color: #fff;
    text-align: center;
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 600;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}
</style>
