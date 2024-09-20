<script setup lang="ts">
const popover = ref()

function getRef() {
  return popover.value
}

const { footer: footerSlot } = useSlots()

defineExpose({
  getRef,
})
</script>

<template>
  <Popover ref="popover" :class="classes['table-display-pop']">
    <div class="content">
      <slot />
    </div>
    <div v-if="footerSlot" class="footer">
      <slot name="footer" />
    </div>
  </Popover>
</template>

<style lang="scss" module="classes">
.table-display-pop {
  margin-top: 6px !important;

  &::before,
  &::after {
    display: none;
  }

  :global(.p-popover-content) {
    padding: 0;
  }
}
</style>

<style lang="scss" scoped>
.content {
  display: flex;
  padding: var(--spacing-md, 6px) var(--spacing-sm, 4px);
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-none, 0px);
  align-self: stretch;
}

.footer {
  display: flex;
  padding: var(--spacing-lg, 8px) 10px;
  align-items: center;
  gap: var(--spacing-lg, 8px);
  border-top: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
}
</style>
