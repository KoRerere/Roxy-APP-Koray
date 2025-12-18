<script setup lang="ts">
import { usePreventMask } from '/@/hooks/usePreventMask'

const popoverRef = useTemplateRef('popover')

const slots: any = useSlots()
const { showPreventMask, hidePreventMask } = usePreventMask()

defineExpose({
  instance: popoverRef,
  show(event: Event, target?: EventTarget) {
    popoverRef.value?.show(event, target)
    showPreventMask()
  },
  hide() {
    popoverRef.value?.hide()
    hidePreventMask()
  },
})
</script>

<template>
  <Popover ref="popover" :class="classes.popover" @show="showPreventMask" @hide="hidePreventMask">
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
  border-top: 0.5px solid var(--component-dropdown-divider, #6a757c);

  &:empty {
    display: none;
  }
}
</style>
