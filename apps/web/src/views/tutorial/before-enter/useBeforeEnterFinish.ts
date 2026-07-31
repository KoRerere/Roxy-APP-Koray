import type { RouteLocationNamedRaw } from 'vue-router'
import { clearBeforeEnterSession, clearBeforeEnterStep, markPendingEcommerceOpenGuide } from '/@/domain/before-enter'
import { getWorkspaceTypeLandingRoute } from '/@/utils/workspace-mode'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks'

export type BeforeEnterExitPath = 'skip' | 'ecommerce'

export function useBeforeEnterFinish() {
  const router = useRouter()
  const userStore = useUserStore()
  const workspaceStore = useWorkspaceStore()
  const { updateOnboardingTaskStatus } = useOnboardingTaskStatus()
  const { userInfo } = storeToRefs(userStore)
  const { currentWorkspace } = storeToRefs(workspaceStore)

  async function finishBeforeEnter(options: {
    path: BeforeEnterExitPath
    landingRoute?: RouteLocationNamedRaw
  }) {
    // 电商 / 跳过链路均消费首次引导状态，避免 enterWorkspace 再弹 WelcomeModal
    if (options.path === 'ecommerce' || options.path === 'skip') {
      await updateOnboardingTaskStatus({
        firstRegisterGuideStatus: true,
        firstWebRegisterGuideStatus: true,
      })
    }

    clearBeforeEnterSession()
    if (userInfo.value.id != null)
      clearBeforeEnterStep(userInfo.value.id)
    await userStore.enterWorkspace()

    const route = options.landingRoute
      ?? { name: getWorkspaceTypeLandingRoute(currentWorkspace.value?.workspaceType, userInfo.value.role) }

    if (options.path === 'ecommerce' && route.name === 'ecommerce-account-list')
      markPendingEcommerceOpenGuide()

    await router.push(route)
  }

  return {
    finishBeforeEnter,
  }
}
