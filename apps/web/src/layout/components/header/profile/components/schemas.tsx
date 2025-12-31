import { defineFormSchema } from '/@/components/rx-form'

import styles from './schemas.module.css'
import { getRegisterValidation, getResetPasswordSchemas } from '/@/views/login/components/schemas'
import RxVerificationCodeSender from '/@/components/rx-verification-code-sender.vue'
import { API } from '/@/api'

export const redeemFormSchemas = defineFormSchema([
  {
    field: 'inviteCode',
    component: 'InputText',
    description: () => <div class={styles.description}>
      {$t('特权码可以提升相应的账号权益，您可以关注Roxy相关社群动态以获取。')}
    </div>,
    componentProps: {
      placeholder: () => $t('请输入特权码'),
    },
    rule: {
      trigger: 'blur',
      validator(zod) {
        return zod.string()
          .min(1, $t('请输入特权码'))
      },
    },
  },
])


export const getSettingPasswordFormSchemas = () => defineFormSchema([
  {
    field: 'email',
    label: $t('邮箱'),
    component: 'InputText',
    componentProps: {
      disabled: true,
    },
  },
  {
    field: 'ver_code',
    label: $t('验证码'),
    component: ({ formModel }) => <RxVerificationCodeSender v-model={formModel.value.ver_code} email={formModel.value.email} request={API.base.userSettingPasswordVerifyCodeList} />,
    componentProps: {
      placeholder: $t('请输入验证码'),
    },
    rule: {
      trigger: 'blur',
      validator(zod) {
        return zod.string().length(6, $t('无效的验证码'))
      },
    },
  },
  {
    field: 'password',
    label: $t('密码'),
    component: 'Password',
    componentProps: {
      feedback: false,
      toggleMask: true,
      placeholder: $t('请设置登录密码'),
    },
    rule: {
      trigger: 'blur',
      validator(zod) {
        return getRegisterValidation(zod.string().min(1, $t('请输入密码')))
      },
    },
  },
])


export const getResetPasswordFormSchemas = () => defineFormSchema([
  {
    field: 'oldPassword',
    component: 'Password',
    label: $t('旧密码'),
    componentProps: {
      feedback: false,
      toggleMask: true,
      placeholder: () => $t('请输入您当前的密码'),
    },
    rule: {
      validator(zod) {
        const z = zod.string()
        return z.min(1, $t('请输入您当前的密码'))
      },
    },
  },
  ...getResetPasswordSchemas()
])
