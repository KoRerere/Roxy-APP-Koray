<script setup lang="tsx">
import Network from './network.vue'
import Notification from './notification.vue'
import Profile from './profile'
import ResourceUpdater from './resource-updater/index.vue'
import WorkspaceManager from './workspace-manager/index.vue'
import LockButton from './lock-button.vue'
</script>

<template>
  <div class="rx-layout-header">
    <WorkspaceManager />
    <div class="top-bar-items">
      <LockButton />
      <Network />
      <Divider class="!ma-0" layout="vertical" />
      <ResourceUpdater />
      <Notification />
      <Profile />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.rx-layout-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-xl, 12px) var(--spacing-2xl, 16px) var(--spacing-xl, 12px) var(--spacing-none, 0px);
}

.top-bar-items {
  display: flex;
  align-items: center;
  gap: var(--spacing-xl, 12px);
}
</style>
