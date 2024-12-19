import { createRouter, createWebHashHistory } from 'vue-router'
import { baseRoutes } from '/@/router/base'
import { useUserStore } from '/@/stores/user'
import { menuRoutes } from './menu'
import { isEqual } from 'es-toolkit'
import { useSimpleLocale } from '/@/stores/locale'

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
        ...menuRoutes,
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
  const simpleLocale = useSimpleLocale()

  if (to.meta?.title) {
    // document.title = to.meta.title as string
  }

  // 设置全局查询参数，保持语言和标题，客服插件需要用到
  const query = { ...to.query, language: simpleLocale.currentLocale, _title: 'roxybrowser' };

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
