<template>
  <Dialog :visible="true" :header="$t('偏好设置')"
    :style="{ width: '100vw', height: '100vh', 'max-height': '100vh', border: 'none' }">
    <Tabs value="0">
      <TabList>
        <Tab value="0">{{ $t('基础设置') }}</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="0">
          <BaseSettings />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </Dialog>
</template>

<script setup lang="ts">
import BaseSettings from './base-settings.vue'

</script>

<style lang="scss">
html,
body {
  background: transparent !important;

  .p-dialog-header {
    -webkit-app-region: drag;
  }

  .p-dialog-close-button {
    -webkit-app-region: no-drag;
  }

  .p-toggleswitch {
    transform: scale(0.7);
    transform-origin: left bottom;
  }

  .p-dialog-content,
  .p-tabs,
  .p-tabpanels {
    height: 100%;
  }

  .p-tabpanels {
    padding-bottom: 0;
    position: relative;
  }
}
</style>
