<script setup lang="tsx">
import SubMenuItem from './sub-menu-item.vue'
import { cloneDeep } from 'es-toolkit'
import { API } from '/@/api'
import { menuRoutes } from '/@/router/menu'
import { useProjectStore } from '/@/stores/project'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import { usePermission } from '/@/hooks/usePermission'
import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { ProjectPin, WorkspaceType } from '/@/enums'
import { genDriver, safeParseJSON } from '/@/utils'
import { blurDomSpotlight, focusDomSpotlight } from '/@/hooks/useDomSpotlight'
import { emitter } from '/@/utils/eventBus'
import type { RouteRecordNameGeneric, RouteRecordRaw } from 'vue-router'

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
const { check } = usePermission()

const badgeMap = ref<Record<NonNullable<RouteRecordNameGeneric>, boolean>>(safeParseJSON(localStorage.getItem('badgeMapCache') || {}))
const driverObj = ref()

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

emitter.on('badgeMap', (key) => {
  if (!Reflect.has(badgeMap.value, key)) {
    Reflect.set(badgeMap.value, key, true)
  }
})

emitter.on('asideMenuGuide', showAsideMenuGuideTour)

function showAsideMenuGuideTour() {
  driverObj.value = genDriver({
    showProgress: false,
    disableActiveInteraction: false,
    allowClose: true,
    overlayClickBehavior: 'close',
    showButtons: ['close'],
    stagePadding: 0,
    popoverOffset: 20,
    steps: [
      {
        element: '#NEW_PROFILE',
        popover: {
          description: $t('点击创建一个新的浏览器窗口。'),
          side: 'right',
          align: 'center',
        },
        onHighlightStarted: () => {
          nextTick(() => {
            requestAnimationFrame(() => {
              focusDomSpotlight('#NEW_PROFILE')
            })
          })
        },
      },
    ],
    onDestroyed: () => {
      blurDomSpotlight()
    },
  })

  driverObj.value.drive()
}

/** 过滤菜单 */
function filterMenus(menus: RouteRecordRaw[]) {
  return menus.filter((item) => {
    if (item.children?.length) {
      item.children = filterMenus(item.children)
    }

    if (item.meta?.type === 'group' && !item.children?.length) {
      return false
    }

    const hasPermission = !item.meta?.permissions?.length || check(item.meta.permissions, item.meta.permissionMode)

    return !item.meta?.hideInMenu && hasPermission
  })
}

async function toCreateBrowser() {
  const { code, msg } = await API.window.userCheckWindowTotalCountList()
  if (code !== 0) {
    handleBusinessCode(code, () => onlyErrorToast(code, msg))
    return
  }

  const query = route.name === 'project-item' ? { projectId: route.params.id } : {}

  if (driverObj.value) {
    driverObj.value.destroy()
    driverObj.value = undefined
    Reflect.set(query, 'driver', 1)
  }

  router.push({ name: 'browser-create', query })
}
</script>

<template>
  <aside class="relative -mt-6.5 pt-6.5 -mb-3 pb-3 -ml-0.5 pl-0.5 -mr-0.75 pr-0.75 flex-1 flex flex-col self-stretch gap-3 aside" :class="{ collapsed }">
    <template v-if="check('Profiles_add')">
      <RxButton id="NEW_PROFILE" class="new-profile-btn" icon="base/rx_ic_browser_add" :label="collapsed ? undefined : $t('创建窗口')" @click="toCreateBrowser" />
    </template>
    <div class="relative flex-1 overflow-hidden">
      <nav class="h-full flex flex-col items-start self-stretch gap-3 overflow-y-auto menu">
        <SubMenuItem v-model:badge-map="badgeMap" class="relative z-1" :items="menus" :collapsed />
      </nav>
    </div>
  </aside>
</template>

<style lang="scss" scoped>
.aside {
  white-space: nowrap;
  word-break: keep-all;
  isolation: isolate;
  overflow: hidden;

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
