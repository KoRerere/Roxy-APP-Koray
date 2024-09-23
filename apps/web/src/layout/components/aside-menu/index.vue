<script setup lang=ts>
import type { RouteRecordRaw } from 'vue-router'
import SubMenuItem from './sub-menu-item.vue'
import { API } from '/@/api'
import { menuRoutes } from '/@/router/menu'
import { useWorkspaceStore } from '/@/stores/workspace'

defineProps({
  collapsed: {
    type: Boolean,
    default: false,
  },
})

const router = useRouter()
const { workspaceID } = storeToRefs(useWorkspaceStore())

const projectList = ref<Partial<RouteRecordRaw>[]>([])

const menus = computed(() => {
  const projectIndex = menuRoutes.findIndex(item => item.name === 'projects')!
  // projects.children = projectList
  return [
    ...menuRoutes.slice(0, projectIndex),
    {
      ...menuRoutes[projectIndex],
      children: projectList.value,
    },
    ...menuRoutes.slice(projectIndex + 1),
  ]
})

async function getProjects() {
  const { data } = await API.limit.userGetProjectInfoByWorkspaceList()
  projectList.value = data.rows.map((item) => {
    return {
      path: ':id',
      name: 'project-item',
      meta: { title: item.projectName, params: { id: item.project_id } },
    }
  })
}

watch(workspaceID, () => {
  getProjects()
}, { immediate: true })

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
