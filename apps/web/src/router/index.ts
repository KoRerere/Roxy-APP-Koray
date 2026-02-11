import { createRouter, createWebHistory } from 'vue-router'
import { baseRoutes } from '/@/router/base'
import { useUserStore } from '/@/stores/user'
import { menuRoutes } from './menu'
import { isEqual } from 'es-toolkit'
import { useSimpleLocale } from '/@/stores/locale'
import { useWorkspaceStore } from '/@/stores/workspace'
import { WorkspaceType } from '/@/enums'
import type { App } from 'vue'
import { useThemeStore } from '/@/stores/theme'

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

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()
  const themeStore = useThemeStore()
  const { currentWorkspace } = useWorkspaceStore()
  const simpleLocale = useSimpleLocale()

  // 设置全局查询参数，保持语言和标题，客服插件需要用到
  const query = { ...to.query, theme: themeStore.realTheme, language: simpleLocale.currentLocale || 'en', _title: 'roxybrowser' }

  noTakeQueryList.forEach((key) => {
    delete query[key]
  })

  if (currentWorkspace?.workspaceType === WorkspaceType.Private && to.name === 'shared') {
    return next({ name: 'home', query })
  }
  else if (currentWorkspace?.workspaceType === WorkspaceType.Public && to.name === 'home') {
    return next({ name: 'shared', query })
  }

  // 禁止当前用户访问非当前角色权限的页面
  if (currentWorkspace?.role && to.meta?.roles && !to.meta?.roles?.includes(currentWorkspace?.role)) {
    const name = currentWorkspace.workspaceType === WorkspaceType.Private ? 'home' : 'shared'
    return next({ name, query })
  }

  if (!whiteList.includes(to.name as string)) {
    if (to.name !== 'login' && !userStore.token) {
      return next({ name: 'login', query })
    }
  }
  if (isEqual(to.query, query)) {
    return next()
  }
  else {
    return next({ ...to, query })
  }
})

if (import.meta.hot) {
  window.router = router
}

export async function setupRouter(app: App) {
  app.use(router)
}

export default router
