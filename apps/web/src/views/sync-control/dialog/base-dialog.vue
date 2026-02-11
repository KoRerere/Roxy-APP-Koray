<script setup lang="ts">
const visible = ref(true)

globalThis.electronAPI.send('app:showCurrentWebviewWindow')
</script>

<template>
  <Dialog v-model:visible="visible" v-bind="$attrs"
    :style="{ 'width': '100vw', 'height': '100vh', 'max-height': '100vh', 'border': 'none' }" @hide="$emit('hide')">
    <slot />
  </Dialog>
</template>

<style lang="scss">
html,
body {
  background: transparent !important;

  .p-dialog {
    transition: none !important;
    animation: none !important;
    transform: none !important;
  }

  .p-dialog-header {
    -webkit-app-region: drag;
    cursor: move;
  }

  .p-dialog-close-button {
    -webkit-app-region: no-drag;
  }

  .p-dialog-content {
    padding-left: 24px;
    padding-right: 24px;
    position: relative;
    overflow: hidden;
  }

  .p-toggleswitch {
    transform: scale(0.7);
    transform-origin: left bottom;
  }

  .p-dialog-content,
  .p-tabs,
  .p-tabpanels {
    // height: 100%;
  }

  .p-tabs {
    height: 100%;

    .p-tab {
      text-transform: capitalize;
    }
  }

  .p-tabpanel {
    // padding-bottom: 24px;
  }

  .p-tabpanels {
    padding-bottom: 24px;
    position: relative;
    padding-left: 0;
    padding-right: 0;
    overflow: auto;
  }
}

.form-item-label {
  text-transform: capitalize;
}
</style>
