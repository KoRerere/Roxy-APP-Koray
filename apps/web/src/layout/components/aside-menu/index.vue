<script setup lang=ts>
import type { RouteRecordRaw } from 'vue-router'
import { cloneDeep } from 'es-toolkit'
import { menuRoutes } from '/@/router/menu'
import { useProjectStore } from '/@/stores/project'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import SubMenuItem from './sub-menu-item.vue'

defineProps({
  collapsed: {
    type: Boolean,
    default: false,
  },
  transitionend: {
    type: Boolean,
    default: true,
  },
})

const router = useRouter()
const roleStore = useRoleStore()
const { currentWorkspace } = storeToRefs(useWorkspaceStore())
const projectStore = useProjectStore()

const projectList = computed(() => {
  return projectStore.projects.map((item) => {
    return {
      path: ':id',
      name: 'project-item',
      meta: { title: item.projectName, params: { id: item.project_id } },
    } as unknown as RouteRecordRaw
  })
})

const menus = computed(() => {
  const projectIndex = menuRoutes.findIndex(item => item.name === 'projects')!
  return filterMenus(cloneDeep([
    ...menuRoutes.slice(0, projectIndex),
    {
      ...menuRoutes[projectIndex],
      children: projectList.value,
    },
    ...menuRoutes.slice(projectIndex + 1),
  ]))
})

watch(currentWorkspace, () => {
  projectStore.getProjects()
}, { immediate: true })

/** 过滤菜单 */
function filterMenus(menus: RouteRecordRaw[]) {
  return menus.filter((item) => {
    if (item.children?.length) {
      item.children = filterMenus(item.children)
    }

    if (item.meta?.type === 'group' && !item.children?.length) {
      return false
    }

    let hasRole = true
    if (item.meta?.roles?.length) {
      hasRole = item.meta.roles.includes(currentWorkspace.value?.role)
    }

    return !item.meta?.hideInMenu && hasRole
  })
}

function toCreateBrowser() {
  router.push({ name: 'browser-create' })
}
</script>

<template>
  <aside class="aside" :class="{ collapsed, transitionend }">
    <template v-if="!roleStore.isViewer">
      <RxButton :label="collapsed ? '' : $t('创建窗口')" icon="base/rx_ic_browser_add" class="new-profile-btn" @click="toCreateBrowser" />
    </template>
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
  overflow: hidden;

  &.collapsed {
    overflow: unset;

    .new-profile-btn {
      margin-left: -3.52px;

      &.p-button-icon-only {
        width: var(--p-button-icon-only-width);
      }
    }
  }

  &.transitionend {
    .menu {
      overflow-y: auto;
    }
  }

  .new-profile-btn {
    flex-shrink: 0;
    white-space: nowrap;
    word-break: keep-all;
    transition: width 0.3s;
  }

  .menu {
    flex: auto;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xl, 12px);
    align-self: stretch;
    overflow: hidden;
  }
}
</style>
