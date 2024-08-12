<script setup lang="ts">
import { routes } from '/@/router';

import { ref } from 'vue'
const isCollapse = ref(true)

const handleOpen = (key: string, keyPath: string[]) => {
  console.log("🚀 ~ handleOpen ~ key, keyPath:", key, keyPath)
}
const handleClose = (key: string, keyPath: string[]) => {
  console.log("🚀 ~ handleClose ~ key, keyPath:", key, keyPath)
}
</script>

<template>
  <div>
    <el-button class="w-15" type="primary" @click="isCollapse = !isCollapse">switch</el-button>
    <el-menu default-active="2" class="el-menu-vertical-demo" :collapse="isCollapse" @open="handleOpen"
      @close="handleClose">
      <el-sub-menu :index="route.name" v-for="(route, index) in routes" :key="route.name">
        <template #title>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 1024 1024">
            <path fill="currentColor"
              d="M715.648 625.152 670.4 579.904l90.496-90.56c75.008-74.944 85.12-186.368 22.656-248.896-62.528-62.464-173.952-52.352-248.96 22.656L444.16 353.6l-45.248-45.248 90.496-90.496c100.032-99.968 251.968-110.08 339.456-22.656 87.488 87.488 77.312 239.424-22.656 339.456l-90.496 90.496zm-90.496 90.496-90.496 90.496C434.624 906.112 282.688 916.224 195.2 828.8c-87.488-87.488-77.312-239.424 22.656-339.456l90.496-90.496 45.248 45.248-90.496 90.56c-75.008 74.944-85.12 186.368-22.656 248.896 62.528 62.464 173.952 52.352 248.96-22.656l90.496-90.496zm0-362.048 45.248 45.248L398.848 670.4 353.6 625.152z">
            </path>
          </svg>

          <span>{{ route.meta.title }}</span>
        </template>
        <div v-for="child in route.children" :key="child.name">
          <router-link :to="{ name: child.name }">{{ child.meta.title }}</router-link>
        </div>
      </el-sub-menu>
    </el-menu>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-menu-vertical-demo:not(.el-menu--collapse)) {
  width: 200px;
  min-height: 400px;
}
</style>