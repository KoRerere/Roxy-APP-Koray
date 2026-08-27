import { h, watch } from 'vue'
import ProxyBuyPermissionTips from '../components/proxy-buy-permission-tips.vue'
import { useDialog } from '/@/hooks/useDialog'
import {
  executeSomethingByBackToSelfWorkspace,
  hasWorkspaceBillingPermission,
} from '/@/hooks/useResponseToast/handleBusinessCode'
import { isCurrentEcommerceWorkspace } from '/@/utils/workspace-mode'
import { OPEN_ROXY_IP_BUY_QUERY } from '../utils/proxy-detect-fail-guide'

/** 广告点击：有费用中心权限则购买，否则 Tips 且不自动切空间 */
export function useProxyDetectFailGuide() {
  const [showModal] = useDialog()
  const router = useRouter()

  /** 切到个人空间后再进入对应购买入口；不在点击广告时自动切空间 */
  function goPersonalWorkspaceAndBuy() {
    const openBuyEntry = executeSomethingByBackToSelfWorkspace(() => {
      const routeName = isCurrentEcommerceWorkspace() ? 'ecommerce-device-list' : 'agent-list'
      router.push({ name: routeName, query: { [OPEN_ROXY_IP_BUY_QUERY]: '1' } })
    })
    void openBuyEntry()
  }

  function showNoBillingPermissionTips() {
    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      slots: {
        container: ({ hideModal }) => h(ProxyBuyPermissionTips, {
          onClose: hideModal,
          onGoPersonal: goPersonalWorkspaceAndBuy,
        }),
      },
    })
  }

  /**
   * 广告整区点击。有权限才执行 onPermitted（打开当前场景购买）。
   * 无权限只出 Tips，不打开商店、不自动切空间。
   */
  function onAdClick(onPermitted?: () => void) {
    if (hasWorkspaceBillingPermission()) {
      onPermitted?.()
      return
    }
    showNoBillingPermissionTips()
  }

  return {
    onAdClick,
    showNoBillingPermissionTips,
    goPersonalWorkspaceAndBuy,
  }
}

/** 消费路由 query，打开当前页对应的 RoxyIP 购买入口 */
export function usePendingOpenRoxyIpBuy(openBuy: () => void) {
  const route = useRoute()
  const router = useRouter()

  function consume() {
    if (route.query[OPEN_ROXY_IP_BUY_QUERY] !== '1')
      return
    const { [OPEN_ROXY_IP_BUY_QUERY]: _, ...query } = route.query
    router.replace({ name: route.name, query })
    openBuy()
  }

  watch(() => route.query[OPEN_ROXY_IP_BUY_QUERY], consume, { immediate: true })
}
