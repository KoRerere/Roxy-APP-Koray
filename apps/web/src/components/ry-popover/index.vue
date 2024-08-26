<script setup lang="ts">
defineProps({
  footer: {
    type: Boolean,
    default: false,
  },
})

const popover = ref()

function getRef() {
  return popover.value
}

defineExpose({
  getRef,
})
</script>

<template>
  <Popover ref="popover" class="table-display-pop">
    <div class="content">
      <slot />
    </div>
    <div v-if="footer" class="footer">
      <slot name="footer" />
    </div>
  </Popover>
</template>

<style lang="scss">
.table-display-pop {
  .p-popover-content {
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
  justify-content: flex-end;
  align-items: center;
  gap: var(--spacing-lg, 8px);
  align-self: stretch;
  border-top: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
}
</style>
