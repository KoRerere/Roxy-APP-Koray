<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import ryPopover from '/@/components/ry-popover'

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
  <div v-ripple class="cursor-pointer table-display" @click="toggle">
    <span class="font-size-[16px] leading-none mdi mdi-tune-vertical" />
    <span>Display</span>
  </div>

  <ry-popover ref="popRef" footer class="table-popover">
    <VueDraggable v-model="sortColumns" :animation="150" handle=".handle">
      <div v-for="item in sortColumns" :key="item.key" class="flex items-center table-popover-column">
        <span class="cursor-grab mdi mdi-drag handle" />
        <span class="flex-auto">{{ item.title }}</span>
        <ToggleSwitch v-model="item._visible" />
      </div>
    </VueDraggable>
    <template #footer>
      <slot name="footer" />
    </template>
  </ry-popover>
</template>

<style lang="scss">
.table-popover {
  &-column {
    padding: var(--spacing-lg, 8px) var(--spacing-md, 6px);
    gap: var(--spacing-sm, 4px);
    min-width: 260px;
  }

  .footer {
    padding: 0;
    border: none;
  }
}
</style>

<style lang="scss" scoped>
.table-display {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-sm, 4px);
  min-width: 24px;
  padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);

  border-radius: var(--radius-sm, 4px);
  border: 0.5px solid var(--Component-Colors-Buttons-Secondary-border-hover, #a3a9ad);
  background: var(--Component-Colors-Buttons-Secondary-bg-hover, #f2f5f7);
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);

  color: var(--Component-Colors-Buttons-Secondary-text-hover, #0e1214);
  text-align: center;
  font-family: Inter;
  font-size: var(--Font-Size-text-sm, 12px);
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
