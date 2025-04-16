<script setup lang="tsx">
import { cloneDeep } from 'es-toolkit'
import Tooltip from 'primevue/tooltip'
import type { RouteRecordRaw } from 'vue-router'
import { API } from '/@/api'
import { RxSvgIcon } from "/@/components/rx-icon";
import { $t } from '/@/locales'
import { getMenuRoutes } from '/@/router/menu'
import { useProjectStore } from '/@/stores/project'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import SubMenuItem from './sub-menu-item.vue'
import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
import { useResponseToast } from '/@/hooks/useResponseToast'

defineProps({
  collapsed: {
    type: Boolean,
    default: false,
  }
})

const { handleBusinessCode } = useHandleBusinessCode()
const [showToast, onlyErrorToast] = useResponseToast()
const router = useRouter()
const roleStore = useRoleStore()
const { currentWorkspace } = storeToRefs(useWorkspaceStore())
const projectStore = useProjectStore()
const menuRoutes = getMenuRoutes()


const projectList = computed(() => {
  return projectStore.projects.filter(item => !!item.topTime).slice(0, 5).map((item) => {
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
watch(currentWorkspace, () => {
  if (currentWorkspace.value?.id) {
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
  if (code === 0) {
    router.push({ name: 'browser-create' })
  } else {
    handleBusinessCode(code, () => {
      showToast(code, msg)
    })
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
  color: var(--Color-neutrals-600, #575D61);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-sm, 18px);
}

.contact-us {
  display: inline;
  color: var(--Colors-Text-text-link, #12A3FC);
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
    gap: 8px;
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
      background-color: transparent;
      box-shadow: none;
    }

    &:hover::-webkit-scrollbar-thumb {
      background-color: rgb(190, 190, 190);
      box-shadow: inset 0 0 6px rgb(186 183 183);
    }

    &:hover::-webkit-scrollbar-track {
      background-color: #f5f5f5;
      box-shadow: inset 0 0 6px rgb(186 183 183);
    }
  }
}
</style>
