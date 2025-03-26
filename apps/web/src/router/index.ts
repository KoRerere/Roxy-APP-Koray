import { createRouter, createWebHashHistory } from 'vue-router'
import { baseRoutes } from '/@/router/base'
import { useUserStore } from '/@/stores/user'
import { getMenuRoutes } from './menu'
import { isEqual } from 'es-toolkit'
import { useSimpleLocale } from '/@/stores/locale'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    ...baseRoutes,
    {
      name: 'home',
      path: '/',
      component: () => import('/@/layout/index.vue'),
      redirect: { name: 'browser-list' },
      children: [
        ...getMenuRoutes(),
        {
          name: 'referral-program',
          path: 'referral-program',
          meta: { title: '推广计划', icon: 'base/rc_ic_user_referral' },
          component: () => import('/@/views/referral-program/index.vue'),
        }
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'home' },
    },
  ],
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  const { currentWorkspace } = useWorkspaceStore()
  const simpleLocale = useSimpleLocale()

  if (to.meta?.title) {
    // document.title = to.meta.title as string
  }

  // 设置全局查询参数，保持语言和标题，客服插件需要用到
  const query = { ...to.query, language: simpleLocale.currentLocale || 'en', _title: 'roxybrowser' };
  // 禁止当前用户访问非当前角色权限的页面
  if (currentWorkspace?.role && to.meta?.roles && !to.meta?.roles?.includes(currentWorkspace?.role)) {
    return next({ name: 'home', query })
  }

  if (to.name !== 'login' && !userStore.token) {
    return next({ name: 'login', query })
  }
  if (isEqual(to.query, query)) {
    return next()
  } else {
    return next({ ...to, query })
  }
})

if (import.meta.hot) {
  window.router = router
}

export default router
