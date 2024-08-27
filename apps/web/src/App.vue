<script lang="ts" setup>
import siderMenu from './components/sider-menu.vue'

const collapsed = ref<boolean>(false)
window.electronAPI.on('browser:launch-process-message', (event) => {
  console.log('browser:launch-process-message', event)
})
</script>

<template>
  <div class="rx-layout">
    <div class="rx-sider" :class="{ collapsed }">
      <div class="logo">
        RoxyBrowser
      </div>
      <siderMenu />
      <div class="position-absolute pa-4 bottom-0 left-0 w-full h-12 cursor-pointer flex items-center gap-2"
        @click="() => (collapsed = !collapsed)">
        <span>{{ collapsed ? 'Show' : 'Hide' }}</span>
      </div>
    </div>
    <div class="rx-main">
      <div class="rx-main-header">
        header
      </div>
      <div class="rx-main-content">
        <RouterView />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.rx-layout {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--Colors-Background-bg-page, #fafbfc);
}

.rx-sider {
  position: relative;
  display: flex;
  width: 220px;
  padding: var(--spacing-2xl, 16px);
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xl, 12px);
  flex-shrink: 0;
  transition: all 0.3s ease;

  &.collapsed {
    width: 64px;
  }
}

.rx-main {
  flex: 1;
  display: flex;
  flex-direction: column;

  &-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: var(--spacing-xl, 12px) var(--spacing-2xl, 16px) var(--spacing-xl, 12px) var(--spacing-none, 0px);
  }

  &-content {
    flex-grow: 1;
    flex-shrink: 0;
    margin-right: var(--spacing-2xl, 16px);
    margin-bottom: var(--spacing-2xl, 16px);
    border-radius: var(--radius-sm, 4px);
    border: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
    background-color: #ffffff;
    overflow: hidden;
  }
}
</style>
