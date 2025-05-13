import { defineFormSchema } from '/@/components/rx-form'
import { $t } from '/@/locales'
import { getRegisterValidation, getResetPasswordSchemas } from '/@/views/login/components/schemas'
import RxVerificationCodeSender from '/@/components/rx-verification-code-sender.vue'
import { API } from '/@/api'


export const getAccountSetupFormSchemas = () => defineFormSchema([
  {
    field: 'email',
    label: $t('邮箱'),
    component: 'InputText',
    componentProps: {
      placeholder: $t('请输入邮箱'),
    },
    rule: {
      trigger: 'change',
      validator(zod) {
        return zod.string().min(1, $t('请输入您的邮箱')).email($t('请输入正确的邮箱'))
      },
    },
  },
  {
    field: 'ver_code',
    label: $t('验证码'),
    component: ({ formModel }) => <RxVerificationCodeSender v-model={formModel.value.ver_code} email={formModel.value.email} request={API.base.userSendAccountPasswordVerifyCodeList} />,
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
