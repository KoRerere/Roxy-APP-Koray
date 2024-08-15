<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import scPopover from '/@/components/sc-popover'

const props = defineProps({
  columns: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
})

const emits = defineEmits(['update:columns'])

const popRef = ref()

function toggle(event: Event) {
  popRef.value.toggle(event)
}

function update(newColumns: any[]) {
  emits('update:columns', newColumns)
}
</script>

<template>
  <div v-ripple class="cursor-pointer table-display" @click="toggle">
    <span class="font-size-[16px] leading-none mdi mdi-tune-vertical" />
    <span>Display</span>
  </div>

  <sc-popover ref="popRef" footer class="table-popover">
    <VueDraggable :model-value="props.columns" :animation="150" handle=".handle" @update:model-value="update">
      <div v-for="item in props.columns" :key="item.key" class="flex items-center table-popover-column">
        <span class="cursor-grab mdi mdi-drag handle" />
        <span class="flex-auto">{{ item.title }}</span>
        <ToggleSwitch v-model="item._hide" />
      </div>
    </VueDraggable>
    <template #footer>
      <span v-ripple class="cursor-pointer table-popover-save">Save for all filters</span>
    </template>
  </sc-popover>
</template>

<style lang="scss">
.table-popover {
  &-column {
    padding: var(--spacing-lg, 8px) var(--spacing-md, 6px);
    min-width: 250px;
  }

  &-save {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-sm, 4px);
    padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
    min-width: 24px;

    color: var(--Colors-Text-text-primary, #171c1f);
    text-align: center;
    font-family: Inter;
    font-size: var(--Font-Size-text-sm, 12px);
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
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
