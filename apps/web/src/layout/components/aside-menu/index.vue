<script setup lang="tsx">
import SubMenuItem from './sub-menu-item.vue'
import { API } from '/@/api'
import { useProjectStore } from '/@/stores/project'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useRouteContext } from '/@/composables/useRouteContext'
import { useTutorialEntityLabels } from '/@/composables/useTutorialEntityLabels'
import { resolveMenuRoutes } from '/@/router/resolve-menu'
import { useSimpleLocale } from '/@/stores/locale'
import { genDriver, safeParseJSON } from '/@/utils'
import { usePermission } from '/@/hooks/usePermission'
import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { blurDomSpotlight, focusDomSpotlight } from '/@/hooks/useDomSpotlight'
import { emitter } from '/@/utils/eventBus'
import { ProjectPin, WorkspaceType } from '/@/enums'

import type { RouteRecordNameGeneric, RouteRecordRaw } from 'vue-router'

const { collapsed = false } = defineProps<{
  collapsed?: boolean
}>()

const route = useRoute()
const router = useRouter()
const roleStore = useRoleStore()
const projectStore = useProjectStore()
const { currentWorkspace } = storeToRefs(useWorkspaceStore())
const { ctx } = useRouteContext()
const tutorialLabels = useTutorialEntityLabels()
const { siteLocale } = storeToRefs(useSimpleLocale())
const { check } = usePermission()
const { handleBusinessCode } = useHandleBusinessCode()
const [, onlyErrorToast] = useResponseToast()

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

const ecommerceGroupList = computed(() => {
  return projectStore.projects.filter(item => item.pinStatus === ProjectPin.pinned).slice(0, 5).map((item) => {
    return {
      path: ':id',
      name: 'ecommerce-group-item',
      meta: { title: item.projectName, params: { id: item.project_id } },
    } as unknown as RouteRecordRaw
  })
})

const menus = computed(() => {
  return resolveMenuRoutes({
    ctx: ctx.value,
    siteLocale: siteLocale.value,
    projectChildren: ctx.value.isNormal ? projectList.value : undefined,
    ecommerceGroupChildren: ctx.value.isEcommerce ? ecommerceGroupList.value : undefined,
    checkPermission: check,
  })
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
  if (ctx.value.isEcommerce)
    return

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
          description: tutorialLabels.value.createEntityGuideDesc,
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

async function checkWindowTotalCountOk() {
  const { code, msg } = await API.window.userCheckWindowTotalCountList()
  if (code !== 0) {
    handleBusinessCode(code, () => onlyErrorToast(code, msg))
    return false
  }

  return true
}

async function toCreateBrowser() {
  const isOk = await checkWindowTotalCountOk()
  if (!isOk)
    return

  const query = route.name === 'project-item' ? { projectId: route.params.id } : {}

  if (driverObj.value) {
    driverObj.value.destroy()
    driverObj.value = undefined
    Reflect.set(query, 'driver', 1)
  }

  router.push({ name: 'browser-create', query })
}

function toCreateAccount() {
  // 电商按设备绑定/续费约束，不走窗口总额度预检
  const query = route.name === 'ecommerce-group-item'
    ? { projectId: String(route.params.id) }
    : {}

  router.push({ name: 'ecommerce-account-create', query })
}
</script>

<template>
  <aside class="relative -mt-6.5 pt-5.25 -mb-3 pb-3 -ml-0.5 pl-0.5 -mr-0.75 pr-0.75 flex-1 flex flex-col self-stretch gap-3 aside" :class="{ collapsed }">
    <div v-if="check('Profiles_add') && (ctx.isNormal || ctx.isEcommerce)" class="flex items-center gap-2">
      <RxButton v-if="ctx.isNormal" id="NEW_PROFILE" class="!h-9 new-profile-btn" icon="base/rx_ic_browser_add" :label="collapsed ? undefined : $t('创建窗口')" @click="toCreateBrowser" />
      <RxButton v-if="ctx.isEcommerce" id="NEW_ACCOUNT" class="!h-9 new-profile-btn" icon="base/rx_ic_browser_add" :label="collapsed ? undefined : $t('创建账号')" @click="toCreateAccount" />
    </div>
    <div class="relative flex-1 min-h-0 overflow-hidden">
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

  &:not(.collapsed) {
    .menu {
      scrollbar-gutter: stable;
    }
  }

  &.collapsed {
    .menu::-webkit-scrollbar {
      display: none;
    }
  }

  // 默认透明，避免被 reset.css 的 *::-webkit-scrollbar 盖过；进入侧栏容器再显示
  .menu {
    scrollbar-width: thin;
    scrollbar-color: transparent transparent;

    &::-webkit-scrollbar-thumb,
    &::-webkit-scrollbar-track {
      background: transparent;
    }
  }

  &:hover .menu {
    scrollbar-color: var(--component-scrollbar-indicator) var(--component-scrollbar-bg);

    &::-webkit-scrollbar-thumb {
      background: var(--component-scrollbar-indicator);
    }

    &::-webkit-scrollbar-track {
      background: var(--component-scrollbar-bg);
    }
  }
}

.new-profile-btn {
  flex: 1;
  position: relative;
  flex-shrink: 0;
  white-space: nowrap;
  word-break: keep-all;
  font-size: 14px;
  z-index: 10;
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
