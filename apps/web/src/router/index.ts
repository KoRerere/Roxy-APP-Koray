import { createRouter, createWebHistory } from 'vue-router'
import { menuRoutes } from './menu'
import { baseRoutes } from '/@/router/base'
import { useUserStore } from '/@/stores/user'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    ...baseRoutes,
    {
      name: 'home',
      path: '/',
      component: () => import('/@/layout/index.vue'),
      redirect: { name: 'browser' },
      children: menuRoutes,
    },
  ],
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()

  if (to.name !== 'login' && !userStore.userInfo.token) {
    return next({ name: 'login' })
  }

  next()
})

export default router
