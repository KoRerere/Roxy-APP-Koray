import InputText from 'primevue/inputtext'
import { tryOnScopeDispose } from '@vueuse/core'
import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon/'
import RxButton from '/@/components/rx-button'
import RxTooltip from '/@/components/rx-tooltip'
import { useCommonUtil } from '/@/layout/components/header/profile/components/settings-popup/useCommonUtil'
import { useDialog, type UseDialogInstance, type UseDialogProps } from '/@/hooks/useDialog'
import {
  fetchIdentityStatusWithNotify,
  formatIdentityRejectedTooltip,
  getIdentityStatus,
  onIdentityStatusSettled,
  syncIdentityStatusPolling,
  type IdentityVerificationStatus,
  type IdentityVerificationType,
} from './identity-verification'

import UploadAvatar from '../upload-avatar.vue'
import ThirdAccount from './components/third-account.vue'
import { oauth2LoginMap, useOauth2Callback } from '/@/utils'
import type { Items, SettingsModule } from '/@/layout/components/header/profile/type'

const IdentityVerificationDialog = defineAsyncComponent(
  () => import('./components/identity-verification-dialog.vue'),
)
const IdentityVerificationDetailsDialog = defineAsyncComponent(
  () => import('./components/identity-verification-details-dialog.vue'),
)
const IdentityVerificationPendingDialog = defineAsyncComponent(
  () => import('./components/identity-verification-pending-dialog.vue'),
)

function getStatusLabel(status: IdentityVerificationStatus) {
  if (status === 'verified')
    return $t('已认证')
  if (status === 'pending')
    return $t('审核中')
  if (status === 'rejected')
    return $t('未通过')
  return $t('未认证')
}

function getActionLabel(status: IdentityVerificationStatus) {
  if (status === 'verified')
    return $t('查看详情')
  if (status === 'pending')
    return $t('查看进度')
  if (status === 'rejected')
    return $t('重新认证')
  return $t('去认证')
}

export function useUserProfilePanel() {
  const { userStore, updateUserName, showToast, onlyErrorToast, simpleLocale } = useCommonUtil()
  const { fetchUserInfo } = userStore
  const [showModal] = useDialog()
  const currentData = ref({} as Recordable<any>)
  const identityInfo = getIdentityStatus()

  const unsubscribeSettled = onIdentityStatusSettled((info) => {
    if (info.status === 'verified')
      showToast(0, $t('您已通过实名认证'))
  })
  tryOnScopeDispose(unsubscribeSettled)

  // 处理第三方账号登录
  useOauth2Callback(async (params) => {
    const { api } = params
    const { code, msg } = await api()

    if (code === 0) {
      updateUserBindEmailList()
      showToast(0, $t('第三方账号绑定成功'))
    }
    else {
      showToast(code, msg)
    }
  })

  async function updateAvatar(item: Items) {
    const { code, msg } = await API.base.userUploadAvatarCreate({
      avatar: item.value,
    })
    onlyErrorToast(code, msg)
    if (code === 0) {
      const { code, data } = await fetchUserInfo()
      if (code !== 0)
        return
      Reflect.set(userStore.userInfo, 'avatar', data.avatar)
    }
  }

  async function updateUserBindEmailList() {
    const { code, data } = await API.base.userBindEmailListList()

    if (code === 0) {
      Object.assign(currentData.value, Object.fromEntries(data.map(item => [
        `tp_${item.bindType.toLowerCase()}`,
        item.bindType.toLowerCase() === 'google' ? item.thirdEmail : item.thirdUserName,
      ])))
    }
  }

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

  async function getUserProfilePanels(data?: any): Promise<SettingsModule> {
    Object.assign(currentData.value, data)

    await updateUserBindEmailList()
    await refreshIdentityInfo()

    return {
      title: $t('个人信息'),
      description: $t('设置您的账号信息和邮箱'),
      list: [
        {
          subtitle: $t('基础信息'),
          items: [
            {
              label: $t('个人头像'),
              text: $t('推荐尺寸为 64*64，最大不超过 2MB'),
              name: 'avatar',
              classes: 'flex-col !items-start gap-4',
              value: currentData.value?.avatar ?? '',
              props: {
                class: 'resize-none w-full',
              },
              component: ({ item, ...props }: { item: Items, props: any }) => {
                return (
                  <UploadAvatar
                    {...item.props}
                    {...props}
                    onChange={() => updateAvatar(item)}
                  />
                )
              },
            },
            {
              label: $t('用户名'),
              text: $t('用于团队协作和成员展示'),
              name: 'userName',
              value: currentData.value?.userName ?? '',
              oldValue: currentData.value?.userName,
              component: ({ item, ...props }: { item: Items, props: any }) => {
                return (
                  <InputText
                    {...item.props}
                    {...props}
                    class="!w-0 flex-1"
                    type="text"
                    onBlur={() => updateUserName(item)}
                  />
                )
              },
            },
            {
              label: $t('实名认证'),
              name: 'identityVerification',
              visible: simpleLocale.currentLocale === 'zh-CN',
              component: () => {
                const { status, rejectedReasons } = identityInfo.value
                const isVerified = status === 'verified'
                const isRejected = status === 'rejected'
                const rejectedTooltip = formatIdentityRejectedTooltip(rejectedReasons)
                return (
                  <div class="w-full flex gap-6 items-center justify-end">
                    <div class="flex flex-1 items-center justify-center gap-1.5 min-w-0 px-2">
                      {isVerified && (
                        <RxSvgIcon
                          name="status/rx_ic_check_fill"
                          color="var(--colors-icon-icon-success)"
                          class="shrink-0 size-4"
                        />
                      )}
                      <span
                        class={[
                          'text-xs font-medium truncate',
                          isVerified
                            ? 'text-[var(--colors-text-text-primary)]'
                            : 'text-[var(--colors-text-text-inactive)]',
                        ]}
                      >
                        {getStatusLabel(status)}
                      </span>
                      {isRejected && rejectedTooltip && (
                        <RxTooltip class="flex shrink-0 items-center">
                          {{
                            default: () => (
                              <RxSvgIcon
                                name="base/rx_ic_info"
                                size="14"
                                color="var(--colors-icon-icon-note)"
                                class="cursor-pointer"
                              />
                            ),
                            content: () => (
                              <div
                                class="max-w-76 whitespace-pre-wrap text-3"
                                style="color: var(--component-tooltip-text-primary)"
                              >
                                {rejectedTooltip}
                              </div>
                            ),
                          }}
                        </RxTooltip>
                      )}
                    </div>
                    <RxButton
                      class="shrink-0"
                      severity="secondary"
                      size="sm"
                      outlined
                      onClick={handleIdentityAction}
                    >
                      {getActionLabel(status)}
                    </RxButton>
                  </div>
                )
              },
            },
          ].filter(item => item.visible !== false),
        },
        {
          subtitle: $t('第三方账号'),
          items: [
            {
              name: 'Google',
              value: currentData.value?.tp_google ?? '',
              label: () => {
                return (
                  <div class="flex items-center gap-2">
                    <RxSvgIcon name="websites/rx_site_google" />
                    <span>Google</span>
                  </div>
                )
              },
              component: () => {
                return <ThirdAccount value={currentData.value?.tp_google} bindType="Google" onBind={oauth2LoginMap.google} onUnbind={updateUserBindEmailList} />
              },
            },
            {
              name: 'Github',
              value: currentData.value?.tp_github ?? '',
              label: () => {
                return (
                  <div class="flex items-center gap-2">
                    <RxSvgIcon name="websites/rx_site_github" />
                    <span>Github</span>
                  </div>
                )
              },
              component: () => {
                return <ThirdAccount value={currentData.value?.tp_github} bindType="Github" onBind={oauth2LoginMap.github} onUnbind={updateUserBindEmailList} />
              },
            },
            {
              name: 'Facebook',
              value: currentData.value?.tp_facebook ?? '',
              label: () => {
                return (
                  <div class="flex items-center gap-2">
                    <RxSvgIcon name="websites/rx_site_facebook" />
                    <span>Facebook</span>
                  </div>
                )
              },
              component: () => {
                return <ThirdAccount value={currentData.value?.tp_facebook} bindType="Facebook" onBind={oauth2LoginMap.facebook} onUnbind={updateUserBindEmailList} />
              },
            },
            {
              name: 'VK',
              value: currentData.value?.tp_vk ?? '',
              label: () => {
                return (
                  <div class="flex items-center gap-2">
                    <RxSvgIcon name="websites/rx_site_vk" />
                    <span>VK (ВКонтакте)</span>
                  </div>
                )
              },
              component: () => {
                return <ThirdAccount value={currentData.value?.tp_vk} bindType="VK" onBind={oauth2LoginMap.vk} onUnbind={updateUserBindEmailList} />
              },
            },
          ],
        },
      ],
    }
  }

  async function openIdentityVerificationEntry() {
    await handleIdentityAction({ showRegulatoryNotice: true })
  }

  return {
    getUserProfilePanels,
    openIdentityVerificationEntry,
  }
}
