<script setup lang="tsx">
import SubMenuItem from './sub-menu-item.vue'
import { cloneDeep } from 'es-toolkit'
import { API } from '/@/api'
import { menuRoutes } from '/@/router/menu'
import { useProjectStore } from '/@/stores/project'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { ProjectPin, WorkspaceType } from '/@/enums'
import type { RouteRecordRaw } from 'vue-router'
import type { Role } from '/@/enums'

const { collapsed = false } = defineProps<{
  collapsed?: boolean
}>()

const { handleBusinessCode } = useHandleBusinessCode()
const [_, onlyErrorToast] = useResponseToast()
const route = useRoute()
const router = useRouter()
const roleStore = useRoleStore()
const projectStore = useProjectStore()
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
  if (!roleStore.isOwner && currentWorkspace.value?.workspaceType === WorkspaceType.Public) {
    const menu = menuRoutes.find(item => item.name === 'shared')!
    return filterMenus(cloneDeep([{ ...menu, meta: { ...menu.meta, hideInMenu: false } }]))
  }

  const projectIndex = menuRoutes.findIndex(item => item.name === 'projects')!
  return filterMenus(cloneDeep([
    ...menuRoutes.slice(0, projectIndex),
    {
      ...menuRoutes[projectIndex],
      children: projectList.value,
    },
    ...menuRoutes.slice(projectIndex + 1),
  ] as RouteRecordRaw[]))
})

// 切换空间后重新获取 pin 项目
watch(currentWorkspace, (workspace, oldWorkspace) => {
  if (workspace?.id && workspace.id !== oldWorkspace?.id && !(!roleStore.isOwner && workspace.workspaceType === WorkspaceType.Public)) {
    setTimeout(() => {
      projectStore.getProjects()
    })
  }
}, { immediate: true })

// watch([
//   () => projectList.value.length,
//   () => collapsed
// ], () => {
//   nextTick(() => {
//     updateMask()
//   })
// })

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
      hasRole = item.meta.roles.includes(currentWorkspace.value?.role as Role)
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
  }
  else {
    router.push({ name: 'browser-create' })
  }
}
// ======================

const _asidemenusRef = useTemplateRef('asidemenus')
// const showTopMask = ref(false)
// const showBottomMask = ref(false)

// function updateMask() {
//   const el = asidemenusRef.value
//   if (!el)
//     return

//   const { scrollTop, scrollHeight, clientHeight } = el

//   const canScroll = scrollHeight > clientHeight + 1
//   if (!canScroll) {
//     showTopMask.value = false
//     showBottomMask.value = false
//     return
//   }

//   showTopMask.value = scrollTop > 0
//   showBottomMask.value = scrollTop + clientHeight < scrollHeight - 1
// }

function handleScroll() {
  // updateMask()
}
</script>

<template>
  <aside class="relative -mt-6.5 pt-6.5 -mb-3 pb-3 -ml-0.5 pl-0.5 -mr-0.75 pr-0.75 flex-1 flex flex-col self-stretch gap-3 aside" :class="{ collapsed }">
    <template v-if="!roleStore.isViewer">
      <img v-if="!collapsed" class="absolute top-0 left-0 w-full z-11 pointer-events-none" src="/images/campaing/new-year-btn.png">
      <RxButton class="new-profile-btn" icon="base/rx_ic_browser_add" :label="collapsed ? undefined : $t('创建窗口')" @click="toCreateBrowser" />
    </template>
    <div class="relative flex-1 overflow-hidden">
      <!-- <div v-if="showTopMask" class="mask top-mask" /> -->
      <nav ref="asidemenus" class="h-full flex flex-col items-start self-stretch gap-3 overflow-y-auto menu" @scroll="handleScroll">
        <SubMenuItem class="relative z-1" :items="menus" :collapsed />
      </nav>
      <!-- <div v-if="showBottomMask" class="mask bottom-mask" /> -->
    </div>
  </aside>
</template>

<style lang="scss" scoped>
.aside {
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
}

.menu {
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

.mask {
  position: absolute;
  width: 100%;
  height: 30px;
  flex-shrink: 0;
  pointer-events: none;
  z-index: 10;

  &.top-mask {
    top: 0;
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.3), transparent);
  }

  &.bottom-mask {
    bottom: 0;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.3), transparent);
  }
}
</style>
