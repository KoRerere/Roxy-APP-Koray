<script lang="ts" setup>
import RouterMenu from '/@/components/menus.vue'

const collapsed = ref<boolean>(false)
</script>

<template>
  <a-layout style="height: 100vh">
    <a-layout-sider v-model:collapsed="collapsed" class="position-relative" theme="light" :trigger="null" collapsible>
      <div class="logo">
        RoxyBrowser
      </div>
      <RouterMenu />
      <div class="position-absolute pa-4 bottom-0 left-0 w-full h-12 cursor-pointer flex items-center gap-2"
        @click="() => (collapsed = !collapsed)">
        <span>{{ collapsed ? 'Show' : 'Hide' }}</span>
      </div>
    </a-layout-sider>
    <a-layout>
      <a-layout-header style="background: pink">
        common header
      </a-layout-header>
      <a-layout-content>
        <RouterView />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<style lang="scss" scoped></style>
