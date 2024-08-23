<script setup lang="ts">
import ryButton from '/@/components/ry-button'
import drawersContent from '/@/views/browser/components/drawers/index.vue'

const drawer = reactive({
  visible: false,
})
</script>

<template>
  <div>
    <div class="button-group">
      <ry-button size="small" severity="secondary" icon="mdi mdi-swap-horizontal" label="Select" />
      <ry-button size="small" severity="secondary" icon="mdi mdi-plus" label="Add proxy"
        @click="drawer.visible = true" />
    </div>

    <Drawer v-model:visible="drawer.visible" position="right" class="browser-drawer-content !w-[auto]"
      :pt="{ mask: 'browser-drawer' }">
      <template #container="{ closeCallback }">
        <drawers-content :close-drawer="closeCallback" />
      </template>
    </Drawer>
  </div>
</template>

<style lang="scss" scoped>
.button-group {
  display: flex;
  padding: var(--spacing-sm, 4px) var(--spacing-none, 0px);
  align-items: center;
  gap: var(--spacing-lg, 8px);
  align-self: stretch;
}
</style>
