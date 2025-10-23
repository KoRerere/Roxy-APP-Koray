<script setup lang="tsx">
import { cloneDeep } from 'es-toolkit'
import type { RouteRecordRaw } from 'vue-router'
import { API } from '/@/api'
import { $t } from '/@/locales'
import { getMenuRoutes } from '/@/router/menu'
import { useProjectStore } from '/@/stores/project'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import SubMenuItem from './sub-menu-item.vue'
import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { ProjectPin } from '/@/enums'

defineProps({
  collapsed: {
    type: Boolean,
    default: false,
  }
})

const { handleBusinessCode } = useHandleBusinessCode()
const [_, onlyErrorToast] = useResponseToast()
const route = useRoute()
const router = useRouter()
const roleStore = useRoleStore()
const projectStore = useProjectStore()
const menuRoutes = getMenuRoutes()
const { currentWorkspace } = storeToRefs(useWorkspaceStore())

const projectList = computed(() => {
  return projectStore.projects.filter(item => item.pinStatus === ProjectPin.pinned).slice(0, 5).map((item) => {
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

// 切换空间后重新获取 pin 项目
watch(currentWorkspace, (workspace, oldWorkspace) => {
  if (workspace?.id && workspace.id !== oldWorkspace?.id) {
    setTimeout(() => {
      projectStore.getProjects()
    })
  }
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
      hasRole = item.meta.roles.includes(currentWorkspace.value?.role!)
    }

    return !item.meta?.hideInMenu && hasRole
  })
}

async function toCreateBrowser() {
  const { code, msg } = await API.window.userCheckWindowTotalCountList()
  if (code !== 0) {
    handleBusinessCode(code, () => onlyErrorToast(code, msg))
    return
  }

  // 项目中创建窗口，方便自动关联项目选择
  if (route.name === 'project-item') {
    router.push({ name: 'browser-create', query: { projectId: route.params.id } })
  } else {
    router.push({ name: 'browser-create' })
  }
}
</script>

<template>
  <aside class="aside" :class="{ collapsed }">
    <template v-if="!roleStore.isViewer">
      <RxButton :label="collapsed ? '' : $t('创建窗口')" icon="base/rx_ic_browser_add" class="new-profile-btn" @click="toCreateBrowser" />
    </template>
    <nav class="menu">
      <SubMenuItem :items="menus" :collapsed />
    </nav>
  </aside>
</template>

<style lang="scss" module>
.description {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-md, 6px);
  align-self: stretch;
  color: var(--primitives-neutrals-600, #575D61);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-sm, 18px);
}

.contact-us {
  display: inline;
  color: var(--colors-text-text-brand, #12A3FC);
  vertical-align: middle;
}
</style>

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
  // background-image: url('/images/bg_scrollcontentblur.svg');
  // background-position: bottom -120px center;
  // background-repeat: no-repeat;

  &.collapsed {

    .menu::-webkit-scrollbar {
      display: none;
    }

    .new-profile-btn {
      :deep(.p-button-label) {
        display: none;
      }
    }
  }

  .new-profile-btn {
    position: relative;
    flex-shrink: 0;
    white-space: nowrap;
    word-break: keep-all;
    transition: width 0.3s;
    height: 36px;
    font-size: 14px;
    z-index: 10;
    opacity: 1 !important;
  }

  .menu {
    flex: auto;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xl, 12px);
    align-self: stretch;
    overflow: hidden;
    overflow-y: auto;

    &::-webkit-scrollbar-thumb,
    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &:hover::-webkit-scrollbar-thumb {
      background: var(--component-scrollbar-indicator);
    }

    &:hover::-webkit-scrollbar-track {
      background: var(--component-scrollbar-bg);
    }
  }
}
</style>
