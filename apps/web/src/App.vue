<script lang="tsx" setup>
import GlobalComponent from '/@/components/business/global-component/index.vue'

import LockScreen from '/@/components/lock-screen/index.vue'
// import AppForceUpgradeModal from '/@/components/business/global-component/app-force-upgrade-modal.vue'

import { useApp } from '/@/hooks/useApp/'
import { useElectronWorkspaceSelection } from '/@/hooks/useElectronWorkspaceSelection'

useApp()
useElectronWorkspaceSelection()
</script>

<template>
  <LockScreen>
    <RouterView />
  </LockScreen>
  <GlobalComponent />
  <!-- <AppForceUpgradeModal /> -->
</template>

<style lang="scss">
.p-tooltip-arrow {
  display: none;
}

.p-tooltip-text {
  color: var(--primitives-neutrals-0, #fff);
  font-family: Inter;
  font-size: 12px;
  font-weight: 600;
  line-height: var(--Line-Height-text-xs, 16px);
}

.global_driver_class {
  min-width: 220px !important;
  max-width: 220px !important;
  padding: 12px !important;
  border-radius: 6px !important;
  background: var(--pattern-tour-tips-bg) !important;
  box-shadow:
    0 3px 8px 0 rgba(0, 0, 0, 0.07),
    0 2px 5px 0 rgba(0, 0, 0, 0.07),
    0 1px 1px 0 rgba(0, 0, 0, 0.07) !important;

  .driver-popover-description,
  .driver-popover-progress-text {
    color: var(--component-tooltip-text-primary);
    font-family: Inter;
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
  }

  .driver-popover-description {
    white-space: pre-wrap;
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

    &.driver-popover-close-btn {
      display: none !important;
    }
  }
}
</style>
