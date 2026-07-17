import { useDialog, type UseDialogInstance, type UseDialogProps } from '/@/hooks/useDialog'
import {
  fetchIdentityStatusWithNotify,
  getIdentityStatus,
  syncIdentityStatusPolling,
  type IdentityVerificationType,
} from './identity-verification'

const IdentityVerificationDialog = defineAsyncComponent(
  () => import('./components/identity-verification-dialog.vue'),
)
const IdentityVerificationDetailsDialog = defineAsyncComponent(
  () => import('./components/identity-verification-details-dialog.vue'),
)
const IdentityVerificationPendingDialog = defineAsyncComponent(
  () => import('./components/identity-verification-pending-dialog.vue'),
)

/** 实名认证弹窗入口：表单 / 审核中 / 详情，供设置页与外部 KYC 拦截共用 */
export function useIdentityVerificationEntry() {
  const [showModal] = useDialog()
  const identityInfo = getIdentityStatus()

  async function refreshIdentityInfo() {
    const info = await fetchIdentityStatusWithNotify()
    identityInfo.value = info
    syncIdentityStatusPolling()
  }

  function showIdentityFormDialog(defaultTab?: IdentityVerificationType, showRegulatoryNotice = false) {
    showModal({
      header: $t('实名认证'),
      class: '!w-[560px]',
      slots: {
        default: ({ hideModal }: UseDialogInstance) => (
          <IdentityVerificationDialog
            defaultTab={defaultTab}
            showRegulatoryNotice={showRegulatoryNotice}
            onSuccess={() => {
              hideModal()
              refreshIdentityInfo()
            }}
          />
        ),
        footer: undefined,
      },
    } as unknown as UseDialogProps)
  }

  function showIdentityPendingDialog() {
    showModal({
      showHeader: false,
      header: $t('实名认证审核中'),
      class: '!w-[440px]',
      slots: {
        container: ({ hideModal }: UseDialogInstance) => (
          <IdentityVerificationPendingDialog
            details={identityInfo.value.details}
            onClose={hideModal}
          />
        ),
        footer: undefined,
      },
    } as unknown as UseDialogProps)
  }

  function showIdentityDetailsDialog() {
    const details = identityInfo.value.details
    if (!details)
      return

    const isEnterprise = details.type === 'enterprise'
    showModal({
      showHeader: false,
      header: $t('实名认证'),
      class: isEnterprise ? '!w-[440px]' : '!w-[384px]',
      slots: {
        container: ({ hideModal }: UseDialogInstance) => (
          <IdentityVerificationDetailsDialog
            details={details}
            onClose={hideModal}
          />
        ),
        footer: undefined,
      },
    } as unknown as UseDialogProps)
  }

  async function handleIdentityAction(options?: { showRegulatoryNotice?: boolean }) {
    const { status, type } = identityInfo.value
    if (status === 'verified') {
      showIdentityDetailsDialog()
      return
    }
    if (status === 'pending') {
      await refreshIdentityInfo()
      if (identityInfo.value.status !== 'pending')
        return
      showIdentityPendingDialog()
      return
    }
    if (status === 'rejected') {
      await refreshIdentityInfo()
      showIdentityFormDialog(identityInfo.value.type ?? type, options?.showRegulatoryNotice)
      return
    }
    showIdentityFormDialog(type, options?.showRegulatoryNotice)
  }

  async function openIdentityVerificationEntry(options?: { showRegulatoryNotice?: boolean }) {
    await handleIdentityAction({ showRegulatoryNotice: options?.showRegulatoryNotice ?? true })
  }

  return {
    handleIdentityAction,
    openIdentityVerificationEntry,
    refreshIdentityInfo,
  }
}
