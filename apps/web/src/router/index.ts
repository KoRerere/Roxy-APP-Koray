import { createRouter, createWebHistory } from 'vue-router'
import { baseRoutes } from '/@/router/base-routes'
import { menuRoutes } from './menu-routes'
import { runNavigationGuards } from '/@/router/guards'
import { registerRouter } from '/@/router/navigation'
import '/@/router/types'
import type { App } from 'vue'
import { useUserStore } from '/@/stores/user'
import { isMainWindow } from '/@/utils'
import { saveLastRoute } from '/@/utils/lastRoute'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    ...baseRoutes,
    {
      name: 'home',
      path: '/',
      component: () => import('/@/layout/index.vue'),
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

registerRouter(router)

router.beforeEach(async (to) => {
  return runNavigationGuards(to)
})

router.afterEach((to) => {
  if (!globalThis.isElectron || !isMainWindow)
    return

  const userStore = useUserStore()
  if (!userStore.token)
    return

  saveLastRoute(to, userStore.userInfo.id)
})

if (import.meta.hot) {
  // @ts-expect-error Window object is not typed
  window.router = router
}

export async function setupRouter(app: App) {
  app.use(router)
}

export default router
