import { createRouter, createWebHistory } from 'vue-router'
import { baseRoutes } from '/@/router/base'
import { menuRoutes } from './menu'
import { isEqual } from 'es-toolkit'
import { useUserStore } from '/@/stores/user'
import { useThemeStore } from '/@/stores/theme'
import { useSimpleLocale } from '/@/stores/locale'
import { useWorkspaceStore } from '/@/stores/workspace'
import { usePermissionStore } from '/@/stores/permission'
import { WorkspaceType } from '/@/enums'
import type { App } from 'vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    ...baseRoutes,
    {
      name: 'home',
      path: '/',
      component: () => import('/@/layout/index.vue'),
      redirect: { name: 'browser-list' },
      children: [
        ...menuRoutes,
        {
          name: 'referral-program',
          path: 'referral-program',
          meta: { title: '推广计划', icon: 'base/rc_ic_user_referral' },
          component: () => import('/@/views/referral-program/index.vue'),
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'home' },
    },
  ],
})

const whiteList = ['oauth2callback']
// 不需要携带的查询参数
const noTakeQueryList = ['official-site-lang', 'official-site-invite-code']

router.beforeEach((to) => {
  const userStore = useUserStore()
  const themeStore = useThemeStore()
  const simpleLocale = useSimpleLocale()
  const permissionStore = usePermissionStore()
  const { currentWorkspace } = useWorkspaceStore()

  // 设置全局查询参数，保持语言和标题，客服插件需要用到
  const query: any = { ...to.query, theme: themeStore.realTheme, language: simpleLocale.currentLocale || 'en', _title: 'roxybrowser' }

  if (Array.isArray(to.meta.permissions) && !permissionStore.check(to.meta.permissions, to.meta.permissionMode)) {
    return { name: 'home', query }
  }

  noTakeQueryList.forEach((key) => {
    delete query[key as keyof typeof query]
  })

  if (currentWorkspace?.workspaceType === WorkspaceType.Private && to.name === 'shared') {
    return { name: 'home', query }
  }
  else if (currentWorkspace?.workspaceType === WorkspaceType.Public && to.name === 'home') {
    return { name: 'shared', query }
  }

  if (!whiteList.includes(to.name as string)) {
    if (to.name !== 'login' && !userStore.token) {
      return { name: 'login', query }
    }
  }
  if (isEqual(to.query, query)) {
    return true
  }
  else {
    return { ...to, query }
  }
})

if (import.meta.hot) {
  // @ts-expect-error Window object is not typed
  window.router = router
}

export async function setupRouter(app: App) {
  app.use(router)
}

export default router
