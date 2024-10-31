import { createRouter, createWebHashHistory } from 'vue-router'
import { baseRoutes } from '/@/router/base'
import { useUserStore } from '/@/stores/user'
import { menuRoutes } from './menu'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    ...baseRoutes,
    {
      name: 'home',
      path: '/',
      component: () => import('/@/layout/index.vue'),
      redirect: { name: 'browser-list' },
      children: menuRoutes,
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'home' },
    },
  ],
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()

  if (to.meta?.title) {
    document.title = to.meta.title as string
  }

  if (to.name !== 'login' && !userStore.token) {
    return next({ name: 'login' })
  }

  next()
})

export default router
