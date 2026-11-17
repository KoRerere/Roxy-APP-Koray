import { h } from 'vue'
import EnterpriseClientModal from './enterprise-client-modal.vue'
import { isEnterpriseProfilePurchaseEligible, isEnterpriseProxyPurchaseEligible } from './eligibility'
import { useDialog } from '/@/hooks/useDialog'

export type EnterprisePurchaseCloseReason = 'close' | 'create-profiles'

export function useEnterpriseClient() {
  const [showModal] = useDialog()

  function showEnterpriseClient({ event, onClosed, purchaseCount, profilePurchaseCount }: {
    event?: { originalEvent: Event }
    onClosed?: (reason: EnterprisePurchaseCloseReason) => void
    purchaseCount?: number
    profilePurchaseCount?: number
  }) {
    let nestedDialogOpen = false
    let closeReason: EnterprisePurchaseCloseReason = 'close'
    const hasPurchase = purchaseCount !== undefined || profilePurchaseCount !== undefined
    const target = event?.originalEvent.target
    const trigger = (target instanceof Element ? target.closest('a') : null)
      || document.activeElement as HTMLElement | null
    showModal({
      uniqueKey: profilePurchaseCount !== undefined
        ? 'enterprise-profile-purchase-success'
        : hasPurchase ? 'enterprise-proxy-purchase-success' : 'enterprise-key-client',
      showHeader: false,
      blockScroll: true,
      closeOnEscape: true,
      beforeClose: () => !nestedDialogOpen,
      handleCancel: () => onClosed?.(closeReason),
      style: {
        width: '640px',
        maxWidth: 'calc(100vw - 32px)',
        ...(!hasPurchase
          ? { overflow: 'auto' }
          : { maxHeight: 'calc(100dvh - 32px)', overflow: 'hidden' }),
      },
      pt: {
        root: {
          'class': !hasPurchase
            ? '!border-none'
            : '!bg-transparent !border-0 !rounded-none !shadow-none',
          ...(!hasPurchase
            ? {}
            : { style: { background: 'transparent', border: '0', borderRadius: '0', boxShadow: 'none' } }),
          'aria-label': hasPurchase ? $t('购买成功') : 'Enterprise/Key Client',
        },
        ...(!hasPurchase
          ? {}
          : {
              content: {
                class: '!m-0 !p-0 !bg-transparent !border-0 !rounded-none !shadow-none',
                style: { background: 'transparent', border: '0', borderRadius: '0', padding: '0', boxShadow: 'none' },
              },
            }),
        mask: '!backdrop-blur-md',
        transition: { onAfterLeave: () => trigger?.focus() },
      },
      slots: {
        container: ({ handleCancel }) => h(EnterpriseClientModal, {
          purchaseCount,
          profilePurchaseCount,
          onClose: handleCancel,
          onCreateProfiles: () => {
            closeReason = 'create-profiles'
            handleCancel()
          },
          onNestedDialogChange: (open: boolean) => {
            nestedDialogOpen = open
          },
        }),
      },
    })
  }

  function openEnterpriseClient(event?: { originalEvent: Event }) {
    showEnterpriseClient({ event })
  }

  /** 付款完成后调用；关闭优惠弹窗后，再继续首次消费、抽奖等后续流程。 */
  function maybeShowEnterpriseProxyPurchase(quantity: number | undefined, onClosed?: () => void) {
    if (!isEnterpriseProxyPurchaseEligible(quantity)) {
      onClosed?.()
      return
    }

    showEnterpriseClient({ purchaseCount: quantity, onClosed })
  }

  /** 仅接收已支付窗口订单的数量；关闭后由支付流程继续导航及活动。 */
  function maybeShowEnterpriseProfilePurchase(quantity: number | undefined, onClosed?: (reason: EnterprisePurchaseCloseReason) => void) {
    if (!isEnterpriseProfilePurchaseEligible(quantity)) {
      onClosed?.('close')
      return
    }

    showEnterpriseClient({ profilePurchaseCount: quantity, onClosed })
  }

  return { openEnterpriseClient, maybeShowEnterpriseProxyPurchase, maybeShowEnterpriseProfilePurchase }
}
