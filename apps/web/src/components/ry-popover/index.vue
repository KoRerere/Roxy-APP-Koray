<script setup lang="ts">
const popoverRef = useTemplateRef('popover')

function getRef() {
  return popoverRef.value
}

const slots: any = useSlots()

defineExpose({
  getRef,
  show(event: Event, target?: EventTarget) {
    popoverRef.value?.show(event, target)
  }
})
</script>

<template>
  <Popover ref="popover" :class="classes.popover">
    <div>
      <slot />
    </div>
    <div v-if="slots.footer" :class="classes.footer">
      <slot name="footer" />
    </div>
  </Popover>
</template>

<style lang="scss" module="classes">
.popover {
  margin-top: 6px !important;
  overflow: hidden;

  &::before,
  &::after {
    display: none;
  }

  :global(.p-popover-content) {
    padding: 0;
  }
}

.footer {
  display: flex;
  padding: var(--spacing-lg, 8px) 10px;
  align-items: center;
  gap: var(--spacing-lg, 8px);
  border-top: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);

  &:empty {
    display: none;
  }
}
</style>
