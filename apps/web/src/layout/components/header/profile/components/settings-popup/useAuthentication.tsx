import Tooltip from 'primevue/tooltip'
import Edit2FA from '../auth-2fa/edit-2fa.vue'
import ViewRecoveryCodes from '../auth-2fa/view-recovery-codes.vue'
import ViewRecoveryEmail from '../auth-2fa/view-recovery-email.vue'
import Auth2fa from '../auth-2fa/index.vue'
import RxButton from '/@/components/rx-button'
import { RxAlert } from '/@/components/rx-alert'
import { $t } from '/@/locales'
import { API } from '/@/api'
import { useCommonUtil } from '/@/layout/components/header/profile/components/settings-popup/useCommonUtil'
import { useDialog } from '/@/hooks/useDialog'
import { getResetPasswordFormSchemas, getSettingPasswordFormSchemas } from '/@/layout/components/header/profile/components/schemas'
import { h, withDirectives } from 'vue'
import type { ObjectDirective } from 'vue'
import type { Items, SettingsModule } from '/@/layout/components/header/profile/type'
import { RecoveryType } from '/@/enums/account'

// TODO 解决 options.instance 为 null 的问题，为 null 会报错
const MyTooltip: ObjectDirective = {
  ...Tooltip,
  beforeMount(el, options, ...args) {
    options.instance ||= {}
    Tooltip.beforeMount?.(el, options, ...args)
  },
}

const EmailChangeDialog = defineAsyncComponent(() => import('./components/email-change-dialog.vue'))
const PhoneChangeDialog = defineAsyncComponent(() => import('./components/phone-change-dialog.vue'))

export function useAuthentication() {
  const { userStore, dialogRef, showToast, showFormDialog, onlyErrorToast } = useCommonUtil()
  const [showModal] = useDialog()
  const router = useRouter()
  const enabled = ref(false)
  const recoverType = ref()

  const getAuthentication = async (): Promise<SettingsModule> => {
    const res = await API.base.userGetValidatorBindInfoList({})
    let enabledDefault = res.data.validatorIsBind === 1
    enabled.value = enabledDefault
    if (res.data.recoverCode === 1) {
      recoverType.value = RecoveryType.Code
    }
    if (res.data.recoverEmail === 1) {
      recoverType.value = RecoveryType.Email
    }

    const items = reactive({
      title: $t('两步验证'),
      description: $t('管理您的密码和身份验证。'),
      list: [
        {
          subtitle: $t('邮箱和密码'),
          items: [
            {
              label: $t('手机号'),
              name: 'phone',
              value: userStore.userInfo?.phone ?? '',
              component: () => {
                return (
                  <div class="w-full flex gap-2 items-center justify-between">
                    <div>{userStore.userInfo?.phone || $t('当前未设置手机号')}</div>
                    <RxButton
                      severity="secondary"
                      size="sm"
                      outlined
                      onClick={showPhoneChangeDialog}
                    >
                      {userStore.userInfo?.phone ? $t('修改手机号') : $t('设置手机号')}
                    </RxButton>
                  </div>
                )
              },
            },
            {
              label: $t('邮箱地址'),
              name: 'email',
              value: userStore.userInfo?.email ?? '',
              component: () => {
                const hasEmail = userStore.userInfo?.email
                return (
                  <div class="w-full flex gap-2 items-center justify-between">
                    {hasEmail
                      ? withDirectives(h('div', { class: 'truncate w-[152px]' }, userStore.userInfo?.email), [
                          [MyTooltip, { value: userStore.userInfo?.email }, '', { top: true }],
                        ])
                      : <div>{$t('当前未设置邮箱')}</div>}
                    <RxButton
                      severity="secondary"
                      size="sm"
                      outlined
                      onClick={showEmailChangeDialog}
                    >
                      {hasEmail ? $t('修改邮箱') : $t('设置邮箱')}
                    </RxButton>
                  </div>
                )
              },
            },
            {
              label: $t('密码'),
              name: 'password',
              component: () => {
                const hasPassword = userStore.userInfo?.setPasswordStatus
                return (
                  <div class="w-full flex items-center justify-between">
                    <div>{hasPassword ? '********' : $t('当前未设置密码')}</div>
                    <RxButton
                      severity="secondary"
                      size="sm"
                      outlined
                      onClick={
                        hasPassword
                          ? showResetPasswordDialog
                          : showSettingPasswordDialog
                      }
                    >
                      {hasPassword ? $t('重置密码') : $t('设置密码')}
                    </RxButton>
                  </div>
                )
              },
            },
          ],
        },
        {
          subtitle: $t('两步验证'),
          items: [
            {
              label: $t('登录时使用 2FA'),
              name: '2faSwitch',
              value: enabled,
              component: ({ item }: { item: Items, props: any }) => {
                return (
                  <Auth2fa
                    defaultValue={enabledDefault}
                    modelValue={item.value}
                    enableBefore={() => {
                      if (userStore.userInfo?.setPasswordStatus)
                        return true
                      return showSettingPasswordDialog()
                    }}
                    onChange={(val: 'code' | 'email' | 'close') => {
                      enabledDefault = !(val === 'close')
                      recoverType.value = val
                    }}
                  />
                )
              },
            },
            {
              label: $t('身份验证应用'),
              hide: (item: Items, items: Items[]) => !items.find(i => i.name === '2faSwitch')?.value,
              component: () => {
                return (
                  <Edit2FA />
                )
              },
            },
            {
              label: $t('恢复代码'),
              value: computed(() => recoverType.value === RecoveryType.Code),
              hide: (item: Items) => !item.value || !enabled.value,
              component: () => {
                return (
                  <ViewRecoveryCodes />
                )
              },
            },
            {
              label: $t('恢复邮箱'),
              value: computed(() => recoverType.value === RecoveryType.Email),
              hide: (item: Items) => !item.value || !enabled.value,
              component: () => {
                return (
                  <ViewRecoveryEmail />
                )
              },
            },
          ],
        },
      ],
    })

    return items
  }

  /** 显示设置密码弹窗 */
  async function showSettingPasswordDialog() {
    if (!userStore.userInfo?.email) {
      showToast(-1, $t('请先设置邮箱'))
      return false
    }

    const { promise, resolve } = Promise.withResolvers<boolean>()

    showFormDialog({
      header: $t('设置密码'),
      class: 'w-[400px]',
      schemas: getSettingPasswordFormSchemas(),
      formProps: {
        layout: 'vertical',
        initialValues: {
          email: userStore.userInfo?.email,
        },
      },
      dialogSlots: {
        beforeForm: () => (
          <RxAlert
            visible={true}
            type="info"
            title={$t('使用邮箱和密码登录您的账号')}
            closable={false}
            class="w-full"
          />
        ),
      },
      handleOk: async (params: any) => {
        const res = await API.base.userSettingPasswordCreate({ ...params })
        onlyErrorToast(res.code, res.msg)
        if (res.code === 0 && params.password) {
          userStore.setPassword(params.password)
          showToast(0, $t('密码设置成功'))
          userStore.fetchUserInfo()
          resolve(true)
        }
        else {
          resolve(false)
        }
      },
      handleCancel: () => {
        resolve(false)
      },
    })

    return promise
  }

  /** 显示重置密码弹窗 */
  async function showResetPasswordDialog() {
    await showFormDialog({
      header: $t('重置密码'),
      class: 'w-[400px]',
      schemas: getResetPasswordFormSchemas(),
      formProps: {
        layout: 'vertical',
      },
      handleOk: async (params: any) => {
        const res = await API.base.userChangePwdCreate({
          old_pwd: params.oldPassword,
          new_pwd: params.newPassword,
        })
        if (res.code === 0) {
          userStore.setPassword('')
          userStore.clearUserInfo()
          showToast(0, $t('密码重置成功'))
          dialogRef?.value?.close?.()
          setTimeout(() => {
            router.push({ name: 'login' })
          })
        }
        else {
          showToast(res.code, res.msg)
          return Promise.reject(res.msg)
        }
      },
    })
  }

  function showEmailChangeDialog() {
    showModal({
      header: userStore.userInfo?.email ? $t('修改邮箱') : $t('设置邮箱'),
      class: '!w-[384px]',
      slots: {
        default: ({ hideModal }) => {
          const onSuccess = async () => {
            hideModal()
            userStore.fetchUserInfo()
          }
          return <EmailChangeDialog onSuccess={onSuccess} />
        },
        footer: undefined,
      },
    })
  }

  function showPhoneChangeDialog() {
    showModal({
      header: userStore.userInfo?.phone ? $t('修改手机号') : $t('设置手机号'),
      class: '!w-[384px]',
      slots: {
        default: ({ hideModal }) => {
          return (
            <PhoneChangeDialog onSuccess={() => {
              hideModal()
              userStore.fetchUserInfo()
            }}
            />
          )
        },
        footer: undefined,
      },
    })
  }

  return {
    getAuthentication,
  }
}
