<script setup lang="tsx">
import Network from './network.vue'
import Notification from './notification.vue'
import Profile from './profile'
import ResourceUpdater from './resource-updater/index.vue'
import DownloadAppButton from './download-app-button.vue'
</script>

<template>
  <div class="rx-layout-header">
    <div class="top-bar-items">
      <Network />
      <Divider class="!ma-0" layout="vertical" />
      <ResourceUpdater v-if="$isElectron" />
      <DownloadAppButton v-else />
      <Notification />
      <Divider class="!ma-0" layout="vertical" />
      <Profile />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.rx-layout-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: var(--spacing-xl, 12px) var(--spacing-2xl, 16px) var(--spacing-xl, 12px) var(--spacing-none, 0px);
}

.top-bar-items {
  display: flex;
  align-items: center;
  gap: var(--spacing-xl, 12px);
}
</style>
