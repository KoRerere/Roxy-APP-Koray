<script setup lang=ts>
import type { RouteRecordRaw } from 'vue-router'
import SubMenuItem from './sub-menu-item.vue'
import { menuRoutes } from '/@/router/menu'

defineProps({
  collapsed: {
    type: Boolean,
    default: false,
  },
})

const router = useRouter()

const projectList = [
  {
    path: ':id',
    name: 'project-item',
    meta: { title: '项目一', params: { id: '1' } },
  },
  {
    path: ':id',
    name: 'project-item',
    meta: { title: '项目二', params: { id: '2' } },
  },
] as unknown as RouteRecordRaw[]

const menus = computed(() => {
  const projectIndex = menuRoutes.findIndex(item => item.name === 'projects')!
  // projects.children = projectList
  return [
    ...menuRoutes.slice(0, projectIndex),
    {
      ...menuRoutes[projectIndex],
      children: projectList,
    },
    ...menuRoutes.slice(projectIndex + 1),
  ]
})

function toCreateBrowser() {
  router.push({ name: 'browser-create' })
}
</script>

<template>
  <aside class="aside" :class="{ collapsed }">
    <ry-button :label="collapsed ? '' : 'New profile'" icon="base/rx_ic_browser_add" class="new-profile-btn" @click="toCreateBrowser" />
    <nav class="menu">
      <SubMenuItem :items="menus" :collapsed />
    </nav>
  </aside>
</template>

<style lang="scss" scoped>
.aside {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl, 12px);
  flex: 1 0 0;
  align-self: stretch;
  white-space: nowrap;
  word-break: keep-all;
  isolation: isolate;

  .menu {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xl, 12px);
    align-self: stretch;
  }

  &.collapsed {
    .new-profile-btn {
      margin-left: -3px;
    }
  }
}
</style>
