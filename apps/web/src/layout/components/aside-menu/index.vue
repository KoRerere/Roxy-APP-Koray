<script setup lang="tsx">
import type { RouteRecordRaw } from 'vue-router'
import { cloneDeep } from 'es-toolkit'
import { menuRoutes } from '/@/router/menu'
import { useProjectStore } from '/@/stores/project'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import SubMenuItem from './sub-menu-item.vue'
import { API } from '/@/api'
import { useDialog } from '/@/hooks/useDialog'
import { $t } from '/@/locales'
import { useUserStore } from '/@/stores/user'

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

const cssModule = useCssModule()
const [dialogInstance] = useDialog()
const router = useRouter()
const roleStore = useRoleStore()
const { currentWorkspace } = storeToRefs(useWorkspaceStore())
const projectStore = useProjectStore()
const { userInfo } = storeToRefs(useUserStore())

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
      hasRole = item.meta.roles.includes(currentWorkspace.value?.role)
    }

    return !item.meta?.hideInMenu && hasRole
  })
}

async function toCreateBrowser() {
  const { useWindowCount, maxWindowCount, useWorkspaceCount, maxWorkspaceCount } = userInfo.value
  const { code } = await API.window.userCreateWindowInspectList()
  if (code === 0) {
    router.push({ name: 'browser-create' })
  } else if (code === 407) {
    // 超出总额度
    dialogInstance.showModal({
      header: $t('窗口额度不足（{percent}）', { percent: `${useWindowCount}/${maxWindowCount}` }),
      class: 'w-[380px]',
      okText: $t('好的'),
      slots: {
        default: () => <div class={cssModule.description}>
          <div>{$t('您的窗口用量已达账号上限。')}</div>
          <div>{$t('您可以通过彻底删除（提示：回收站中的窗口也会计算用量）不常用的窗口来恢复相应额度，或关注Roxy相关社群动态以获取更多。')}</div>
        </div>,
      },
    })
  } else if (code === 408) {
    // 超出空间最大额度
    dialogInstance.showModal({
      header: $t('该工作空间的窗口额度不足（{percent}）', { percent: `${useWorkspaceCount}/${maxWorkspaceCount}` }),
      class: 'w-[380px]',
      okText: $t('好的'),
      slots: {
        default: () => <div class={cssModule.description}>
          <div>{$t('您在当前工作空间中可创建窗口的数量已经到达上限。')}</div>
          <div>{$t('您可以通过彻底删除（提示：回收站中的窗口也会计算用量）不常用的窗口来恢复相应额度，或增加为当前工作空间分配的总窗口数量。')}</div>
        </div>,
      },
    })
  }
}
</script>

<template>
  <aside class="aside" :class="{ collapsed, transitionend }">
    <template v-if="!roleStore.isViewer">
      <RxButton :label="collapsed ? '' : $t('创建窗口')" icon="base/rx_ic_browser_add" class="new-profile-btn"
        @click="toCreateBrowser" />
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
    overflow: unset;
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
    height: 34px;
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
