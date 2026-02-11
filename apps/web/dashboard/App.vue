<script setup lang="ts">
import Dashboard from './components/dashboard.vue'
import BlobBg from '/@/components/blob-bg.vue'
</script>

<template>
  <Toast />
  <Dashboard />
  <BlobBg />
</template>

<style>
body {
  overflow: auto;
}

.global_driver_class {
  min-width: 220px;
  max-width: 220px;
  padding: 12px;
  border-radius: 6px;
  background: var(--pattern-tour-tips-bg);
  box-shadow:
    0 3px 8px 0 rgba(0, 0, 0, 0.07),
    0 2px 5px 0 rgba(0, 0, 0, 0.07),
    0 1px 1px 0 rgba(0, 0, 0, 0.07);

  .driver-popover-description,
  .driver-popover-progress-text {
    color: var(--component-tooltip-text-primary);
    font-family: Inter;
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
  }

  .driver-popover-footer {
    margin-top: 6px;
  }

  .driver-popover-arrow-side-left.driver-popover-arrow {
    border-left-color: var(--pattern-tour-tips-bg);
  }

  .driver-popover-arrow-side-right.driver-popover-arrow {
    border-right-color: var(--pattern-tour-tips-bg);
  }

  .driver-popover-arrow-side-top.driver-popover-arrow {
    border-top-color: var(--pattern-tour-tips-bg);
  }

  .driver-popover-arrow-side-bottom.driver-popover-arrow {
    border-bottom-color: var(--pattern-tour-tips-bg);
  }

  button {
    min-width: 60px;
    padding: 4px 8px;
    text-align: center;
    border-radius: 4px;
    background: var(--colors-alpha-alpha-white-20);
    color: var(--component-tooltip-text-primary);
    font-family: Inter;
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
    border: none;
    text-shadow: none;

    &:focus,
    &:hover {
      background: var(--colors-alpha-alpha-white-20);
    }
  }
}
</style>
