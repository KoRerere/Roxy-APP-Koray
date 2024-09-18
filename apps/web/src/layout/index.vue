<script lang="ts" setup>
import AsideMenu from './components/aside-menu/index.vue'
import Profile from './components/profile.vue'
import ResourceUpdater from './components/resource-updater.vue'

import { API } from '/@/api'

const collapsed = ref<boolean>(false)

onMounted(() => {
  const dict = localStorage.getItem('$dict_map')
  if (!dict) {
    API.base.userGetDictVersionList()
      .then(({ data }) => API.base.userGetSystemDictV2Create({ type: Object.keys(data) }))
      .then(({ data }) => {
        const dict = {}
        data.forEach((item) => {
          if (!dict[item.type])
            dict[item.type] = []
          dict[item.type].push(item)
        })
        localStorage.setItem('$dict_map', JSON.stringify(dict))
      })
  }
})
</script>

<template>
  <div class="rx-layout">
    <div class="rx-sider" :class="{ collapsed }">
      <div class="logo">
        <SvgIcon name="base/logo" size="32" />
        <template v-if="!collapsed">
          RoxyBrowser
        </template>
      </div>
      <AsideMenu :collapsed />
      <div class="position-absolute pa-4 bottom-0 left-0 w-full h-12 cursor-pointer flex items-center gap-2"
           @click="() => (collapsed = !collapsed)"
      >
        <span>{{ collapsed ? 'Show' : 'Hide' }}</span>
      </div>
    </div>
    <div class="rx-main">
      <div class="rx-main-header">
        header
        <div class="flex gap-2">
          <ResourceUpdater />
          <Profile />
        </div>
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
  transition: all 0.25s ease;
  will-change: width;

  &.collapsed {
    width: 64px;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: var(--spacing-md, 6px);
    flex-wrap: nowrap;
    color: var(--Color-neutrals-950, #0e1214);
    text-align: center;
    font-family: Archivo;
    font-size: 14px;
    font-style: normal;
    font-weight: 700;
    line-height: normal;
    user-select: none;
  }
}

.rx-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-xl, 12px) var(--spacing-2xl, 16px) var(--spacing-xl, 12px) var(--spacing-none, 0px);
  }

  &-content {
    flex: 1;
    margin-right: var(--spacing-2xl, 16px);
    margin-bottom: var(--spacing-2xl, 16px);
    border-radius: var(--radius-sm, 4px);
    border: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
    background-color: #ffffff;
    overflow: hidden;
  }
}
</style>
