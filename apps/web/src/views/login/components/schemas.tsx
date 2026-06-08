import PhoneInput from '/@/views/login/components/phone-login/phone.vue'
import CodeInput from '/@/views/login/components/phone-login/code.vue'
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import TsFormInputPassword from '/@/views/lab/components/form/m-input-password.vue'
import { RxSvgIcon } from '/@/components/rx-icon'
import { defineFormSchema } from '/@/components/rx-form/'

import { z } from 'zod'

export function getRegisterValidation(z: z.ZodString) {
  const tip = $t('必须包含数字和字母，6-20位')

  return z.min(6, tip).max(20, tip).refine((val) => {
    return /[a-z]/i.test(val) && /\d/.test(val)
  }, {
    message: tip,
  })
}

export function getEmailSchemas(isRegister = false) {
  return defineFormSchema([
    {
      field: 'user_name',
      component: ({ formModel }) => {
        return (
          <TsFormInputText v-model={formModel.value.user_name}>
          </TsFormInputText>
        )
      },
      componentProps: {
        size: 'lg',
        preIcon: 'base/rx_ic_mail',
        placeholder: $t('请输入您的邮箱'),
      },
      rule: {
        trigger: 'change',
        validator(zod) {
          const z = zod.string()
          if (isRegister) {
            return z.min(1, $t('请输入您的邮箱')).email($t('请输入正确的邮箱'))
          }
          return z.min(1, $t('请输入您的邮箱'))
        },
      },
    },
  ])
}

export const EmailSchema = z.string().min(1, $t('请输入您的邮箱')).email($t('请输入正确的邮箱'))
export const emailValidateLoading = ref(false)
export function checkEmailValid(email: string) {
  try {
    EmailSchema.parse(email)
    return true
  }
  catch (error) {
    return false
  }
}

function isEmailFormFieldsReady(userName?: string) {
  return checkEmailValid(userName ?? '') && !emailValidateLoading.value
}

function renderInviteCodeLink(showInviteCodeInput: Ref<boolean>) {
  return () => (
    <div
      class="flex items-center justify-center gap-1.5 cursor-pointer"
      onClick={() => { showInviteCodeInput.value = !showInviteCodeInput.value }}
    >
      <span class="tt-secondary text-3.25 font-500">{$t('我有邀请码')}</span>
      <RxSvgIcon class={`transition-transform duration-200 ${showInviteCodeInput.value ? 'rotate-180' : ''}`} name="base/rx_ic_chevron_down" />
    </div>
  )
}

const inviteCodeFieldProps = {
  size: 'lg' as const,
  preIcon: 'base/rx_ic_binary',
  feedback: false,
  toggleMask: true,
  placeholder: $t('邀请码（选填）'),
}

export function getFormSchemas(
  isRegister = false,
  options?: { hideInviteCode?: boolean, autoExpandInviteCode?: boolean },
) {
  /** 非中文邮箱：默认显示切换按钮且折叠，仅接口确认新用户后自动展开；中文邮箱不展示 */
  const enableInviteCode = !options?.hideInviteCode
  const showInviteCodeInput = ref(enableInviteCode && !!options?.autoExpandInviteCode)

  const inviteCodeSchemas = enableInviteCode
    ? defineFormSchema([
        {
          field: '_inviteCodeLink',
          component: renderInviteCodeLink(showInviteCodeInput),
        },
        {
          field: 'inviteCode',
          component: ({ formModel }: any) => {
            return <TsFormInputText v-model={formModel.value.inviteCode}></TsFormInputText>
          },
          vIf: () => showInviteCodeInput.value,
          componentProps: inviteCodeFieldProps,
        },
      ])
    : []

  return defineFormSchema([
    ...getEmailSchemas(isRegister),
    {
      field: 'password',
      component: ({ formModel }) => {
        return <TsFormInputPassword v-model={formModel.value.password}></TsFormInputPassword>
      },
      vIf: ({ formModel }) => isEmailFormFieldsReady(formModel.value.user_name),
      componentProps: {
        size: 'lg',
        preIcon: 'base/rx_ic_unlock',
        feedback: false,
        toggleMask: true,
        placeholder: () => isRegister ? $t('请设置您的密码') : $t('请输入您的密码'),
      },
      rule: {
        validator(zod) {
          const z = zod.string()

          if (isRegister) {
            return getRegisterValidation(zod.string().min(1, $t('请设置您的密码')))
          }
          return z.min(1, $t('请输入您的密码'))
        },
      },
    },
    ...inviteCodeSchemas,
  ])
}

export function getPhoneSchemas() {
  const isRegistered = ref<boolean | undefined>()
  const showInviteCodeInput = ref(false)

  const shouldShowInviteCodeInput = () => showInviteCodeInput.value

  return defineFormSchema([
    {
      field: 'phone',
      component: ({ formModel }) => {
        return (
          <PhoneInput v-model={formModel.value.phone}></PhoneInput>
        )
      },
      componentProps: {
        size: 'lg',
        feedback: false,
        toggleMask: true,
        placeholder: $t('请输入您的手机号'),
      },
      rule: {
        validator(zod) {
          const z = zod.string()
          return z.min(1, $t('请输入您的手机号')).max(11, $t('请输入正确的手机号'))
        },
      },
    },
    {
      field: 'verCode',
      component: ({ formModel }) => {
        return (
          <CodeInput
            v-model={formModel.value.verCode}
            phone={formModel.value.phone}
            isRegistered={isRegistered.value}
            onUpdate:isRegistered={(val) => { isRegistered.value = val }}
            showInviteCodeInput={showInviteCodeInput.value}
            onUpdate:showInviteCodeInput={(val) => { showInviteCodeInput.value = val }}
          />
        )
      },
      componentProps: {
        size: 'lg',
        preIcon: 'base/rx_ic_binary',
        feedback: false,
        toggleMask: true,
        placeholder: $t('请输入您的验证码'),
      },
      rule: {
        validator(zod) {
          const z = zod.string()
          return z.min(1, $t('请输入您的验证码')).max(6, $t('验证码不超过 {num} 位', { num: 6 }))
        },
      },
    },
    {
      field: '_inviteCodeLink',
      component: renderInviteCodeLink(showInviteCodeInput),
    },
    {
      field: 'inviteCode',
      component: ({ formModel }: any) => {
        return <TsFormInputText v-model={formModel.value.inviteCode}></TsFormInputText>
      },
      vIf: shouldShowInviteCodeInput,
      componentProps: inviteCodeFieldProps,
    },
  ])
}

export function getResetPasswordSchemas() {
  return defineFormSchema([
    {
      field: 'newPassword',
      component: 'Password',
      label: $t('新密码'),
      componentProps: {
        feedback: false,
        toggleMask: true,
        placeholder: () => $t('请输入您的新密码'),
      },
      rule: {
        validator(zod) {
          const z = zod.string()
          return getRegisterValidation(z.min(1, $t('请输入您的新密码')))
        },
      },
    },
    {
      field: 'confirmPassword',
      component: 'Password',
      label: $t('确认密码'),
      componentProps: {
        feedback: false,
        toggleMask: true,
        placeholder: () => $t('请再次输入您的新密码'),
      },
      rule: {
        validator(zod, formModel) {
          const z = zod.string()
          return z
            .min(1, $t('请再次输入您的新密码'))
            .refine((val) => {
              return val === formModel.value.newPassword
            }, {
              message: $t('两次输入的密码不一致'),
            })
        },
      },
    },
  ])
}
