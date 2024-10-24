import { z } from 'zod'
import { defineFormSchema } from '/@/components/rx-form/'
import { $t } from '/@/locales'

export function getRegisterValidation() {
  return z.string().min(1, $t('请设置您的密码')).min(6, $t('必须包含数字和大小写字母，8-20位')).max(20, $t('必须包含数字和大小写字母，8-20位')).refine((val) => {
    return /[a-z]/i.test(val) && /\d/.test(val)
  }, {
    message: $t('Password must contain at least one letter and one number'),
  })
}

export function getFormSchemas(isRegister = false) {
  return defineFormSchema([
    {
      field: 'user_name',
      component: 'InputText',
      label: () => isRegister ? $t('邮箱') : $t('邮箱 / 用户名'),
      componentProps: {
        placeholder: () => isRegister ? $t('请输入您的邮箱') : $t('请输入您的邮箱或用户名'),
      },
      rule: {
        trigger: 'change',
        validator(zod) {
          const z = zod.string()
          if (isRegister) {
            return z.min(1, $t('请输入您的邮箱')).email($t('请输入正确的邮箱'))
          }
          return z.min(1, $t('请输入您的邮箱或用户名'))
        },
      },
    },
    {
      field: 'password',
      component: 'Password',
      label: () => $t('密码'),
      componentProps: {
        feedback: false,
        toggleMask: true,
        placeholder: () => isRegister ? $t('请设置您的密码') : $t('请输入您的密码'),
      },
      rule: {
        validator(zod) {
          const z = zod.string()

          if (isRegister) {
            return getRegisterValidation()
          }
          return z.min(1, $t('请输入您的密码'))
        },
      },
    },
  ])
}
