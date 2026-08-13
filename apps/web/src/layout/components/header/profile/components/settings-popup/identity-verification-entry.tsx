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

  function showIdentityFormDialog(
    defaultTab?: IdentityVerificationType,
    options?: { showRegulatoryNotice?: boolean, showRejectedNotice?: boolean },
  ) {
    showModal({
      header: $t('实名认证'),
      class: '!w-[560px]',
      slots: {
        default: ({ hideModal }: UseDialogInstance) => (
          <IdentityVerificationDialog
            defaultTab={defaultTab}
            showRegulatoryNotice={options?.showRegulatoryNotice}
            showRejectedNotice={options?.showRejectedNotice}
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

  /** 表单顶部 Alert：法规说明与失败原因互斥，法规优先 */
  function resolveFormNoticeOptions(options?: { showRegulatoryNotice?: boolean, showRejectedNotice?: boolean }) {
    const showRegulatoryNotice = options?.showRegulatoryNotice ?? false
    if (showRegulatoryNotice)
      return { showRegulatoryNotice: true, showRejectedNotice: false }

    return {
      showRegulatoryNotice: false,
      showRejectedNotice: options?.showRejectedNotice ?? false,
    }
  }

  async function handleIdentityAction(options?: { showRegulatoryNotice?: boolean, showRejectedNotice?: boolean }) {
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
      if (identityInfo.value.status !== 'rejected') {
        await handleIdentityAction(options)
        return
      }
      // 未通过重新提交：默认展示失败原因；调用方显式传法规说明时不覆盖
      const noticeOptions = resolveFormNoticeOptions({
        showRegulatoryNotice: options?.showRegulatoryNotice,
        showRejectedNotice: options?.showRejectedNotice ?? true,
      })
      showIdentityFormDialog(identityInfo.value.type ?? type, noticeOptions)
      return
    }
    showIdentityFormDialog(type, resolveFormNoticeOptions(options))
  }

  async function openIdentityVerificationEntry(options?: { showRegulatoryNotice?: boolean, showRejectedNotice?: boolean }) {
    // 通知等外部入口先拉最新状态，再按 verified / rejected / pending 分流弹窗
    await refreshIdentityInfo()
    await handleIdentityAction(options)
  }

  return {
    handleIdentityAction,
    openIdentityVerificationEntry,
    refreshIdentityInfo,
  }
}
