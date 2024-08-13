<script lang="ts" setup>
import RouterMenu from '/@/components/menus.vue'
import CreateIcon from '/@/utils/createIcon'

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
           @click="() => (collapsed = !collapsed)"
      >
        <CreateIcon :name="collapsed ? 'ArrowRightOutlined' : 'ArrowLeftOutlined'" />
        <span v-if="!collapsed">Hide</span>
      </div>
    </a-layout-sider>
    <a-layout>
      <a-layout-header style="background: yellowgreen">
        common header
      </a-layout-header>
      <a-layout-content>
        <RouterView />
      </a-layout-content>
      <!-- <a-layout-footer style="text-align: center">
        Ant Design ©2018 Created by Ant UED
      </a-layout-footer> -->
    </a-layout>
  </a-layout>
</template>

<style lang="scss" scoped></style>
