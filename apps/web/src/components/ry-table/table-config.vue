<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'

const props = defineProps({
  columns: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
})

const emit = defineEmits(['update:columns'])

const sortColumns = computed({
  get() {
    return props.columns
  },
  set(value) {
    emit('update:columns', value)
  },
})

const popRef = ref()

function toggle(event: Event) {
  popRef.value.getRef().toggle(event)
}
</script>

<template>
  <ryButton severity="secondary" size="small" outlined icon="base/rx_ic_slider_v" label="Display" @click="toggle" />
  <ryPopover ref="popRef" footer :class="display['table-popover']">
    <VueDraggable v-model="sortColumns" :animation="150" handle=".handle">
      <div v-for="item in sortColumns" :key="item.key" class="flex items-center"
        :class="display['table-popover-column']">
        <span class="cursor-grab mdi mdi-drag handle" />
        <span class="flex-auto">{{ item.title }}</span>
        <ToggleSwitch v-model="item._visible" />
      </div>
    </VueDraggable>
    <template #footer>
      <slot name="footer" />
    </template>
  </ryPopover>
</template>

<style lang="scss" module="display">
.table-popover {
  &-column {
    padding: var(--spacing-lg, 8px) var(--spacing-md, 6px);
    gap: var(--spacing-sm, 4px);
    min-width: 260px;
  }
}
</style>
