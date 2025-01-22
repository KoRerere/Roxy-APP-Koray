<script setup lang="ts">
import Header from './header.vue'
import WindowList from './window-list.vue'

electronAPI.send('app:showCurrentWebviewWindow')
</script>

<template>
  <div class="synchronizer">
    <Header />
    <WindowList selectionMode="multiple" />
  </div>
</template>

<style lang="scss">
html,
body {
  background: transparent;
  --p-disabled-opacity: 1;
}
</style>

<style lang="scss" scoped>
.synchronizer {
  width: 100vw;
  height: 100vh;
  display: flex;
  padding: var(--spacing-lg, 8px) var(--spacing-2xl, 16px) var(--spacing-2xl, 16px) var(--spacing-2xl, 16px);
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-lg, 8px);
  flex-shrink: 0;
  border-radius: 8px;
  background: var(--Color-neutrals-950, #0e1214);
  box-shadow:
    0px 3px 17px 0px rgba(0, 0, 0, 0.04),
    0px 4px 30px 0px rgba(0, 0, 0, 0.12),
    0px 3px 8px 0px rgba(0, 0, 0, 0.07),
    0px 2px 5px 0px rgba(0, 0, 0, 0.07);
}
</style>
